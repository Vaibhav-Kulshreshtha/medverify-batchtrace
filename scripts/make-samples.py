"""Recreate printable, fictional pack panels on macOS with Pillow and opencv-python."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import cv2

SAMPLES = Path(__file__).resolve().parents[1] / "public" / "samples"
SAMPLES.mkdir(parents=True, exist_ok=True)
FONTS = Path("/System/Library/Fonts/Supplemental")
def font(name, size):
    return ImageFont.truetype(str(FONTS / name), size)

regular = font("Arial.ttf", 40)
bold = font("Arial Bold.ttf", 52)
micro = font("Arial Bold.ttf", 23)
for letter, batch in [("A","00742A"), ("B","00791B"), ("C","")]:
    paper = Image.new("RGB", (1440, 890), "#eaece7")
    draw = ImageDraw.Draw(paper)
    draw.rectangle((60, 55, 1380, 835), fill="#fefdf7", outline="#80978e", width=3)
    draw.rectangle((60, 55, 97, 835), fill="#00695d")
    draw.text((154, 102), "FICTIONAL DEMONSTRATION PACK", fill="#006358", font=micro)
    draw.text((154, 147), "Velmora Tablets", font=bold, fill="#172c32")
    draw.text((156, 222), "25 mg", font=regular, fill="#172c32")
    draw.line((154, 313, 1286, 313), fill="#adc4ba", width=3)
    rows = [
        "Product: Velmora Tablets",
        "Strength: 25 mg",
        "Manufacturer: Lumen Vale Labs",
        f"Batch No: {batch}",
        "Mfg Date: 01/2025",
        "Expiry Date: 12/2028",
    ]
    for i, row in enumerate(rows):
        draw.text((154, 342 + i * 69), row, fill="#192027", font=regular)
    if batch:
        payload = '{"batch":"' + batch + '"}'
        matrix = cv2.QRCodeEncoder_create().encode(payload)
        qr = Image.fromarray(matrix).resize((matrix.shape[0] * 7, matrix.shape[1] * 7), Image.Resampling.NEAREST)
        paper.paste(qr.convert("RGB"), (1070, 407))
    else:
        # Printed areas have been completely rubbed away, without recoverable hidden text.
        for box in [(152,144,850,214),(151,343,887,397),(149,545,890,611)]:
            draw.rectangle(box, fill="#dfdfd5")
            for offset in (12,23,37):
                draw.line((box[0]+8,box[1]+offset,box[2]-11,box[1]+offset+3),fill="#eeeee4",width=7)
    draw.line((154, 772, 1286, 772), fill="#adc4ba", width=2)
    draw.text((154, 790), f"SAMPLE {letter}    /    FOR SOFTWARE DEMONSTRATION ONLY", font=micro, fill="#396353")
    paper.save(SAMPLES / f"{letter}.png", optimize=True)
