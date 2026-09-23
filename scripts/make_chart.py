"""Bar chart: skala connectome berbagai model (untuk dokumen FlyBrain MCP)."""
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

plt.rcParams["font.sans-serif"] = ["DejaVu Sans"]
plt.rcParams["axes.unicode_minus"] = False

# Sumber: Winding et al. 2023 (larva); Scheffer et al. 2020 (hemibrain);
# Dorkenwald & Schlegel et al. 2024 (FAFB); Janelia/Google 3 Sep 2026 (male CNS)
cats = ["Larva\n(Science 2023)", "Hemibrain\n(Janelia 2020)",
        "FAFB Betina\n(FlyWire 2024)", "CNS Jantan\n(Janelia+Google 2026)"]
vals = [3016, 25700, 139255, 166000]

ACCENT = "#1B6B7A"  # aksen gelap DM-1 (#37DCF2 terlalu terang untuk halaman putih)
TEXT = "#333333"

fig, ax = plt.subplots(figsize=(10, 5.6))
bars = ax.bar(cats, vals, color=ACCENT, width=0.58, edgecolor="white")

for bar, val in zip(bars, vals):
    label = f"{val:,}".replace(",", ".")
    ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + max(vals) * 0.02,
            label, ha="center", va="bottom", fontsize=11, color=TEXT)

ax.set_title("Skala connectome: jumlah neuron yang dipetakan penuh",
             fontsize=14, pad=15, color=TEXT)
ax.set_ylabel("Jumlah neuron", fontsize=11, color=TEXT)
ax.set_ylim(0, 190000)
ax.spines[["top", "right"]].set_visible(False)
ax.grid(axis="y", alpha=0.3, color="#E0E0E0")
ax.yaxis.set_major_formatter(lambda x, _: f"{int(x):,}".replace(",", "."))

out = "/home/z/my-project/research/connectome_scale.png"
fig.savefig(out, dpi=200, bbox_inches="tight", pad_inches=0.1,
            facecolor="white", edgecolor="none")
print("saved:", out)
