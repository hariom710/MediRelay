import os, glob, re

root = r"D:\projets\MediRelay\frontend\src"
any_count = 0
for path in glob.glob(os.path.join(root, "**", "*.tsx"), recursive=True) + glob.glob(os.path.join(root, "**", "*.ts"), recursive=True):
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    matches = re.findall(r'as\s+any\b', content)
    if matches:
        any_count += len(matches)
        print(f"{path}: {len(matches)} `as any` occurrences")
print(f"\nTotal: {any_count}")
