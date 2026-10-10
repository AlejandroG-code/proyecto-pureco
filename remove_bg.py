from PIL import Image
import os
import glob

def remove_white_bg(img_path, out_path):
    img = Image.open(img_path).convert("RGBA")
    datas = img.getdata()
    
    newData = []
    # If a pixel is very close to white, make it transparent
    for item in datas:
        if item[0] > 240 and item[1] > 240 and item[2] > 240:
            newData.append((255, 255, 255, 0))
        else:
            newData.append(item)
            
    img.putdata(newData)
    img.save(out_path, "PNG")

if __name__ == "__main__":
    src_dir = "/home/ale/Pictures/Dani/WhatsApp Unknown 2026-10-08 at 11.26.16"
    dest_dir = "/home/ale/Documents/Programming/Dani/public/assets"
    
    mapping = {
        "WhatsApp Image 2026-10-08 at 11.23.57.jpeg": "logo.png",
        "WhatsApp Image 2026-10-08 at 11.23.59.jpeg": "logo_text.png",
        "WhatsApp Image 2026-10-08 at 11.23.59 (1).jpeg": "celular.png",
        "WhatsApp Image 2026-10-08 at 11.23.59 (2).jpeg": "computadora.png",
        "WhatsApp Image 2026-10-08 at 11.23.59 (3).jpeg": "audifonos.png",
        "WhatsApp Image 2026-10-08 at 11.23.59 (4).jpeg": "legos.png",
        "WhatsApp Image 2026-10-08 at 11.23.59 (5).jpeg": "rompecabezas.png",
        "WhatsApp Image 2026-10-08 at 11.23.59 (6).jpeg": "juegos_mesa.png",
        "WhatsApp Image 2026-10-08 at 11.23.59 (7).jpeg": "plumones.png",
        "WhatsApp Image 2026-10-08 at 11.23.59 (8).jpeg": "acuarela.png",
        "WhatsApp Image 2026-10-08 at 11.23.59 (9).jpeg": "gises.png",
        "WhatsApp Image 2026-10-08 at 11.23.59 (10).jpeg": "icon_apagado.png",
        "WhatsApp Image 2026-10-08 at 11.23.59 (11).jpeg": "icon_proceso.png",
        "WhatsApp Image 2026-10-08 at 11.23.59 (12).jpeg": "icon_terminado.png",
        "WhatsApp Image 2026-10-08 at 11.23.59 (13).jpeg": "icon_error.png",
        "WhatsApp Image 2026-10-08 at 11.23.59 (14).jpeg": "icon_espera.png",
        "WhatsApp Image 2026-10-08 at 11.25.48.jpeg": "box_arte.png",
        "WhatsApp Image 2026-10-08 at 11.25.55.jpeg": "box_electronica.png",
        "WhatsApp Image 2026-10-08 at 11.26.03.jpeg": "box_juguetes.png"
    }
    
    for f in os.listdir(src_dir):
        if f in mapping:
            remove_white_bg(os.path.join(src_dir, f), os.path.join(dest_dir, mapping[f]))
            print(f"Processed {f} -> {mapping[f]}")
