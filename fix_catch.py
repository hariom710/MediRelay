import os, glob

root = r"D:\projets\MediRelay\frontend\src"
for path in glob.glob(os.path.join(root, "**", "*.tsx"), recursive=True) + glob.glob(os.path.join(root, "**", "*.ts"), recursive=True):
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    new_content = content.replace("catch (err: any)", "catch (err: unknown)")
    if new_content != content:
        with open(path, "w", encoding="utf-8") as f:
            f.write(new_content)
        print(f"Updated: {path}")
print("Done")
