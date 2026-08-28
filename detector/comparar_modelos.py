# -*- coding: utf-8 -*-
"""Compare candidate Spanish-capable base models as Fast-DetectGPT scorers.

For every model it scores three groups of texts and reports:
  - normalized curvature (curvature / sqrt(tokens), comparable across lengths)
  - perplexity
Groups: eval/humano (verified pre-LLM human prose), eval/maquina (verified
machine text), escenarios 1-3 (the working document).

A better detector separates the human and machine groups more widely. Texts a
model generated itself are excluded from its own machine average (self-detection
is trivially easy and would inflate the score).
"""
import gc
import glob
import math
import os
import sys

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

BASE = os.path.dirname(os.path.abspath(__file__))

MODELS = [
    ("DeepESP/gpt2-spanish-medium", ["gen_deepesp"]),
    ("Qwen/Qwen2.5-0.5B", ["gen_qwen15"]),
    ("Qwen/Qwen2.5-1.5B", ["gen_qwen15"]),
    ("utter-project/EuroLLM-1.7B", []),
    ("BSC-LT/salamandra-2b", []),
]

FILES = (
    sorted(glob.glob(os.path.join(BASE, "eval", "humano", "*.txt")))
    + sorted(glob.glob(os.path.join(BASE, "eval", "maquina", "*.txt")))
    # escenarios/ lives inside this folder. It used to sit one level up, next
    # to the detector, and the move broke this path silently: glob returns
    # nothing for a missing directory, so the run would have compared the
    # models on the labelled corpus alone and reported it as a full comparison.
    + [os.path.join(BASE, "escenarios", d, "cuerpo.txt")
       for d in ("1-original", "2-solo-skill", "3-skill-mas-detector")]
)


def load_tokenizer(name):
    try:
        tok = AutoTokenizer.from_pretrained(name)
        return lambda text: tok(text, return_tensors="pt").input_ids[0]
    except Exception:
        from huggingface_hub import hf_hub_download
        from tokenizers import ByteLevelBPETokenizer
        bpe = ByteLevelBPETokenizer(hf_hub_download(name, "vocab.json"),
                                    hf_hub_download(name, "merges.txt"))
        return lambda text: torch.tensor(bpe.encode(text).ids, dtype=torch.long)


@torch.no_grad()
def score_ids(model, ids, device, window):
    sum_ll = sum_mu = sum_var = 0.0
    n = 0
    step = window - 1
    for s in range(0, max(len(ids) - 1, 1), step):
        w = ids[s:s + window]
        if len(w) < 2:
            break
        inp = w.unsqueeze(0).to(device)
        logits = model(inp).logits[0][:-1].cpu().float()
        labels = w[1:]
        for a in range(0, logits.size(0), 128):
            sl = logits[a:a + 128]
            lp = torch.log_softmax(sl, dim=-1)
            p = torch.softmax(sl, dim=-1)
            lab = labels[a:a + 128]
            ll = lp.gather(-1, lab.unsqueeze(-1)).squeeze(-1)
            mu = (p * lp).sum(-1)
            var = (p * lp.square()).sum(-1) - mu.square()
            sum_ll += ll.sum().item()
            sum_mu += mu.sum().item()
            sum_var += var.sum().item()
            n += lab.numel()
    curv = (sum_ll - sum_mu) / math.sqrt(sum_var)
    return curv, curv / math.sqrt(n), math.exp(-sum_ll / n), n


def group_of(path):
    if os.sep + "humano" + os.sep in path:
        return "humano"
    if os.sep + "maquina" + os.sep in path:
        return "maquina"
    return "escenario"


def main():
    device = "cuda" if torch.cuda.is_available() else "cpu"
    summary = []
    for name, self_gen in MODELS:
        print(f"\n===== {name} =====", flush=True)
        encode = load_tokenizer(name)
        dtype = torch.bfloat16 if name != "DeepESP/gpt2-spanish-medium" else None
        kwargs = {"torch_dtype": dtype} if dtype else {}
        model = AutoModelForCausalLM.from_pretrained(name, **kwargs).to(device).eval()
        window = 1024
        rows = []
        for path in FILES:
            text = open(path, encoding="utf-8").read()
            ids = encode(text)
            try:
                curv, cnorm, ppl, n = score_ids(model, ids, device, window)
            except torch.cuda.OutOfMemoryError:
                torch.cuda.empty_cache()
                curv, cnorm, ppl, n = score_ids(model, ids, device, 512)
            label = os.path.relpath(path, TAREA).replace("\\", "/")
            rows.append((label, group_of(path), curv, cnorm, ppl, n))
            print(f"  {label:<45} {group_of(path):<9} cnorm={cnorm:>7.3f} ppl={ppl:>8.1f} n={n}", flush=True)
        hum = [r[3] for r in rows if r[1] == "humano"]
        maq = [r[3] for r in rows if r[1] == "maquina"
               and not any(g in r[0] for g in self_gen)]
        esc = {r[0].split("/")[1]: r[3] for r in rows if r[1] == "escenario"}
        gap = (sum(maq) / len(maq)) - (sum(hum) / len(hum))
        min_gap = min(maq) - max(hum)
        order_ok = esc["1-original"] > esc["2-solo-skill"] > esc["3-skill-mas-detector"]
        summary.append((name, gap, min_gap, order_ok, esc))
        print(f"  -> gap medio maquina-humano: {gap:.3f} | brecha minima: {min_gap:.3f} | orden escenarios ok: {order_ok}", flush=True)
        del model
        gc.collect()
        torch.cuda.empty_cache()

    print("\n===== RESUMEN =====")
    print(f"{'modelo':<30} {'gap medio':>10} {'brecha min':>11} {'orden 1>2>3':>12}")
    for name, gap, min_gap, order_ok, esc in sorted(summary, key=lambda x: -x[1]):
        print(f"{name:<30} {gap:>10.3f} {min_gap:>11.3f} {str(order_ok):>12}")


if __name__ == "__main__":
    main()
