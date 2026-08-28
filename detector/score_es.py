# -*- coding: utf-8 -*-
"""Fast-DetectGPT (sampling-free analytic variant) with a Spanish base model.

Computes the conditional probability curvature from Bao et al. (ICLR 2024),
aggregated over 1024-token windows so long documents are scored whole, plus
perplexity as a secondary metric. Same math as scripts/fast_detect_gpt.py
(get_sampling_discrepancy_analytic) in the official repo, with reference
model == scoring model.

Higher curvature  -> more machine-like (text sits on a probability peak).
Higher perplexity -> less predictable for the model.

Absolute thresholds are NOT calibrated for Spanish: use scores comparatively
(same fragment, before vs. after).
"""
import math
import sys

import torch
from transformers import AutoModelForCausalLM

MODEL = "DeepESP/gpt2-spanish-medium"


def load_tokenizer():
    """The BNE repo ships a legacy slow tokenizer that transformers v5 no longer
    converts, so build the byte-level BPE directly from vocab.json + merges.txt."""
    try:
        from transformers import AutoTokenizer
        tok = AutoTokenizer.from_pretrained(MODEL)
        return lambda text: tok(text, return_tensors="pt").input_ids[0]
    except Exception:
        from huggingface_hub import hf_hub_download
        from tokenizers import ByteLevelBPETokenizer
        vocab = hf_hub_download(MODEL, "vocab.json")
        merges = hf_hub_download(MODEL, "merges.txt")
        bpe = ByteLevelBPETokenizer(vocab, merges)
        return lambda text: torch.tensor(bpe.encode(text).ids, dtype=torch.long)


@torch.no_grad()
def score_text(model, encode, device, text):
    ids = encode(text)
    ctx = model.config.n_positions
    sum_ll = sum_mu = sum_var = 0.0
    n_labels = 0
    step = ctx - 1
    for start in range(0, max(len(ids) - 1, 1), step):
        window = ids[start:start + ctx]
        if len(window) < 2:
            break
        inp = window.unsqueeze(0).to(device)
        logits = model(inp).logits[0].float()
        lprobs = torch.log_softmax(logits[:-1], dim=-1)
        probs = torch.softmax(logits[:-1], dim=-1)
        labels = inp[0][1:]
        ll = lprobs.gather(-1, labels.unsqueeze(-1)).squeeze(-1)
        mu = (probs * lprobs).sum(-1)
        var = (probs * lprobs.square()).sum(-1) - mu.square()
        sum_ll += ll.sum().item()
        sum_mu += mu.sum().item()
        sum_var += var.sum().item()
        n_labels += labels.numel()
    curvature = (sum_ll - sum_mu) / math.sqrt(sum_var)
    perplexity = math.exp(-sum_ll / n_labels)
    return curvature, perplexity, n_labels


def main(paths):
    device = "cuda" if torch.cuda.is_available() else "cpu"
    encode = load_tokenizer()
    model = AutoModelForCausalLM.from_pretrained(MODEL).to(device).eval()
    print(f"modelo: {MODEL} | dispositivo: {device} | contexto: {model.config.n_positions}")
    print(f"{'archivo':<32} {'curvatura':>10} {'perplejidad':>12} {'tokens':>7}")
    for path in paths:
        text = open(path, encoding="utf-8").read()
        curv, ppl, n = score_text(model, encode, device, text)
        name = path.replace("\\", "/").rsplit("/", 1)[-1]
        print(f"{name:<32} {curv:>10.3f} {ppl:>12.1f} {n:>7}")


if __name__ == "__main__":
    main(sys.argv[1:])
