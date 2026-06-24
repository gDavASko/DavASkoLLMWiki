# -*- coding: utf-8 -*-
"""Generate the 7 article figures as PNG via matplotlib (no cairo needed)."""
import os
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch

OUT = os.path.join(os.path.dirname(__file__), "figs")
os.makedirs(OUT, exist_ok=True)

INK = "#1a1f2b"; MUTED = "#5b6573"; BLUE = "#2456b8"; LBLUE = "#9bb4e0"
BOXB = "#f1f5fd"; BOXBE = "#9db8e6"; GRN = "#effaf6"; GRNE = "#7fcab8"
RAW = "#fdf3ec"; RAWE = "#e0a878"; MARK = "#fff7e6"; MARKE = "#d9a843"
BASE = "#e3edfb"; ACC2 = "#0e7c6b"
plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 11})

def box(ax, x, y, w, h, fc, ec, title, sub=None, bold=True, tsize=10.5):
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0,rounding_size=0.8",
                                fc=fc, ec=ec, lw=1.2))
    ax.text(x + w/2, y + h/2 + (0.06*h if sub else 0), title, ha="center", va="center",
            fontsize=tsize, color=INK, fontweight="bold" if bold else "normal")
    if sub:
        ax.text(x + w/2, y + h/2 - 0.28*h, sub, ha="center", va="center", fontsize=8.5, color=MUTED)

def arrow(ax, x1, y1, x2, y2, color="#7a8aa0"):
    ax.add_patch(FancyArrowPatch((x1, y1), (x2, y2), arrowstyle="-|>", mutation_scale=12,
                                 lw=1.3, color=color, shrinkA=0, shrinkB=0))

def save(fig, name):
    fig.savefig(os.path.join(OUT, name), dpi=200, bbox_inches="tight", facecolor="white")
    plt.close(fig); print("wrote", name)

def newax(w=10, h=3.0, xlim=100, ylim=30):
    fig, ax = plt.subplots(figsize=(w, h))
    ax.set_xlim(0, xlim); ax.set_ylim(0, ylim); ax.axis("off"); ax.invert_yaxis()
    return fig, ax

# ── Fig 1 — pipelines ─────────────────────────────────────────────────────
fig, ax = newax(10, 3.4, 100, 32)
ax.text(1, 2, "Offline indexing", color=MUTED, fontsize=9)
xs = [1, 21, 41, 61, 82]; ws = [16, 18, 18, 18, 17]
labs = [("Scan layers","wiki/ + raw/"),("Structure-aware","chunking"),("Batched embed","Jina v3, GPU/CPU"),("Shard per layer","centroid = mean"),("Index + vector","shards")]
for i,(x,w,(t,s)) in enumerate(zip(xs,ws,labs)):
    box(ax, x, 4, w, 6, BOXB, BOXBE, t, s, tsize=9.5)
    if i: arrow(ax, xs[i-1]+ws[i-1], 7, x, 7)
ax.text(1, 16, "Online query", color=MUTED, fontsize=9)
box(ax, 1, 18, 16, 6, GRN, GRNE, "Parse query", "symbols + phrase", tsize=9.5)
box(ax, 21, 15.5, 19, 4.5, GRN, GRNE, "Stream A: symbols", tsize=9.5, bold=True)
box(ax, 21, 22, 19, 4.5, GRN, GRNE, "Stream B: semantic", tsize=9.5, bold=True)
box(ax, 44, 18, 19, 6, GRN, GRNE, "Unified ranking", "+ graph-lift, labels", tsize=9.5)
box(ax, 67, 18, 22, 6, GRN, GRNE, "Context dump", "SOURCE / SUMMARY", tsize=9.5)
arrow(ax, 17, 20, 21, 17.7); arrow(ax, 17, 22, 21, 24.2)
arrow(ax, 40, 17.7, 44, 20); arrow(ax, 40, 24.2, 44, 22); arrow(ax, 63, 21, 67, 21)
save(fig, "fig1_pipeline.png")

# ── Fig 2 — layered model ─────────────────────────────────────────────────
fig, ax = newax(10, 3.8, 100, 34)
ax.text(1, 2.5, "Dependency graph (downward only)", color=MUTED, fontsize=9)
box(ax, 2, 4, 20, 4.5, BOXB, BOXBE, "project-a-wiki", tsize=9.5)
box(ax, 25, 4, 20, 4.5, BOXB, BOXBE, "project-b-wiki", tsize=9.5)
box(ax, 13, 13, 20, 4.5, BOXB, BOXBE, "framework-wiki", tsize=9.5)
box(ax, 13, 21, 20, 4.5, BOXB, BOXBE, "engine-wiki", tsize=9.5)
box(ax, 13, 29, 20, 4.5, BASE, "#5b8def", "llm-wiki (base)", tsize=9.5)
arrow(ax, 12, 8.5, 20, 13); arrow(ax, 35, 8.5, 26, 13)
arrow(ax, 23, 17.5, 23, 21); arrow(ax, 23, 25.5, 23, 29)
ax.text(36, 16, '"depends on /', color=MUTED, fontsize=8.5)
ax.text(36, 18.5, ' can read from"', color=MUTED, fontsize=8.5)
ax.text(56, 2.5, "Inside one layer", color=MUTED, fontsize=9)
box(ax, 56, 4, 42, 10, RAW, RAWE, "raw/ — source of truth (immutable)",
    "code · GDDs · transcripts · API docs · indexed as raw-<layer>-<name>", tsize=10)
box(ax, 56, 21, 42, 12, GRN, GRNE, "wiki/ — derived, curated pages",
    "concepts · entities · runbooks · sources · syntheses · decisions", tsize=10)
arrow(ax, 70, 14, 70, 21, color=MUTED)
ax.text(67.5, 17.5, "summarized\ninto", color=INK, fontsize=8.5, ha="right", va="center")
ax.add_patch(FancyArrowPatch((90, 21), (90, 14), connectionstyle="arc3,rad=-0.4",
             arrowstyle="-|>", mutation_scale=10, lw=1.2, ls="--", color="#b08968"))
ax.text(85, 17.5, "provenance\nhash", color="#b08968", fontsize=8, ha="center", va="center")
save(fig, "fig2_layers.png")

# ── Fig 3 — shared model ──────────────────────────────────────────────────
fig, ax = newax(10, 3.2, 100, 30)
box(ax, 58, 2, 40, 16, "#eef5ff", "#5b8def", "", tsize=9)
ax.text(60, 4.5, "System location (per machine)", color=MUTED, fontsize=9)
box(ax, 60, 6, 36, 4.5, MARK, MARKE, "marker: config.json -> model path", tsize=9)
box(ax, 60, 12, 36, 4.5, "#e3edfb", "#5b8def", "model (1.1 GB), one copy", tsize=9)
for i,y in enumerate([2.5, 9.5, 16.5]):
    box(ax, 2, y, 22, 4.6, BOXB, BOXBE, f"Knowledge base #{i+1}", tsize=9.5)
    arrow(ax, 24, y+2.5, 60, 8.3)
ax.text(33, 20.5, "read marker -> one shared model", color=MUTED, fontsize=8.5)
ax.text(2, 23.6, "Resolution order (first match wins):", color=INK, fontsize=9, fontweight="bold")
box(ax, 2, 25.2, 20, 3.8, BOXB, BOXBE, "env variable", tsize=9)
box(ax, 26, 25.2, 16, 3.8, MARK, MARKE, "marker", tsize=9)
box(ax, 46, 25.2, 22, 3.8, BOXB, BOXBE, "repo-local fallback", tsize=9)
box(ax, 72, 25.2, 26, 3.8, "#fdeeee", "#cf9a9a", "none -> ask user", tsize=9)
arrow(ax, 22, 27.1, 26, 27.1); arrow(ax, 42, 27.1, 46, 27.1); arrow(ax, 68, 27.1, 72, 27.1)
save(fig, "fig3_model.png")

# ── chart helpers ─────────────────────────────────────────────────────────
def barfig(name, groups, series, ylim, ylabel, fmt="{:.3f}", figsize=(7.6,3.2), colors=(BLUE,LBLUE)):
    fig, ax = plt.subplots(figsize=figsize)
    import numpy as np
    x = np.arange(len(groups)); n=len(series); w=0.8/n
    for i,(lab,vals) in enumerate(series):
        bars=ax.bar(x+(i-(n-1)/2)*w, vals, w, label=lab, color=colors[i%len(colors)], edgecolor="white")
        for b,v in zip(bars,vals):
            ax.text(b.get_x()+b.get_width()/2, v, fmt.format(v), ha="center", va="bottom", fontsize=9, color=INK)
    ax.set_xticks(x); ax.set_xticklabels(groups); ax.set_ylim(0,ylim); ax.set_ylabel(ylabel)
    ax.spines[["top","right"]].set_visible(False); ax.grid(axis="y", color="#eef1f6")
    ax.set_axisbelow(True)
    if n>1: ax.legend(frameon=False, fontsize=9, loc="upper right")
    fig.tight_layout(); save(fig, name)

# Fig 4 — semantic vs lexical
barfig("fig4_results.png", ["recall@5","MRR","nDCG@5"],
       [("semantic",[0.633,0.718,0.626]),("lexical (grep)",[0.333,0.435,0.303])],
       0.85, "score")
# Fig 5 — refinement progression (single series, 3 bars, shaded)
fig, ax = plt.subplots(figsize=(7.6,3.2))
labs=["original\n(symbols first)","+ unified\nscore ranking","+ strict symbol\nextraction"]
vals=[0.641,0.685,0.718]; cols=[LBLUE,"#6f93cf",BLUE]
bars=ax.bar(labs, vals, color=cols, edgecolor="white", width=0.6)
for b,v in zip(bars,vals): ax.text(b.get_x()+b.get_width()/2, v, f"{v:.3f}", ha="center", va="bottom", fontsize=10, color=INK)
ax.set_ylim(0,0.8); ax.set_ylabel("hybrid MRR"); ax.spines[["top","right"]].set_visible(False)
ax.grid(axis="y", color="#eef1f6"); ax.set_axisbelow(True); fig.tight_layout(); save(fig,"fig5_refine.png")
# Fig 6 — chunking
barfig("fig6_chunking.png", ["MRR","nDCG@5"],
       [("structure-aware",[0.718,0.626]),("fixed window",[0.666,0.585])],
       0.85, "score")
# Fig 7 — GPU speedup
fig, ax = plt.subplots(figsize=(7.6,3.0))
labs=["CPU","+ batching","GPU (DirectML)"]; vals=[1.0,1.1,8.0]; cols=[LBLUE,"#7f9fd0",ACC2]
bars=ax.bar(labs, vals, color=cols, edgecolor="white", width=0.55)
for b,v in zip(bars,vals): ax.text(b.get_x()+b.get_width()/2, v, f"{v:.1f}x", ha="center", va="bottom", fontsize=10, color=INK)
ax.set_ylim(0,8.8); ax.set_ylabel("relative throughput"); ax.spines[["top","right"]].set_visible(False)
ax.grid(axis="y", color="#eef1f6"); ax.set_axisbelow(True); fig.tight_layout(); save(fig,"fig7_gpu.png")

print("ALL FIGURES DONE ->", OUT)
