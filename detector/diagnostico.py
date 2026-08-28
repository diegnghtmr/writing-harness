# -*- coding: utf-8 -*-
"""Per-paragraph diagnosis for the humanization loop.

Splits a UTF-8 text file on blank lines and scores every paragraph with the
same Fast-DetectGPT analytic criterion as score_es.py, printing a ranking from
most machine-like to most human-like. The normalized column (curvature divided
by sqrt(tokens)) makes paragraphs of different lengths comparable.
"""
import math
import sys

import torch
from transformers import AutoModelForCausalLM

import score_es


def main(path, top=None):
    device = "cuda" if torch.cuda.is_available() else "cpu"
    encode = score_es.load_tokenizer()
    model = AutoModelForCausalLM.from_pretrained(score_es.MODEL).to(device).eval()
    text = open(path, encoding="utf-8").read()
    paras = [p.strip() for p in text.split("\n\n") if p.strip()]
    rows = []
    for i, p in enumerate(paras):
        curv, ppl, n = score_es.score_text(model, encode, device, p)
        rows.append((curv / math.sqrt(n), curv, ppl, n, i, p))
    rows.sort(reverse=True)
    if top:
        rows = rows[:top]
    print(f"{'rank':>4} {'parr':>4} {'curv/sqrt(n)':>13} {'curvatura':>10} {'perplejidad':>12} {'tokens':>7}  inicio")
    for r, (cn, curv, ppl, n, i, p) in enumerate(rows, 1):
        print(f"{r:>4} {i:>4} {cn:>13.3f} {curv:>10.3f} {ppl:>12.1f} {n:>7}  {p[:60]}")


if __name__ == "__main__":
    main(sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else None)
