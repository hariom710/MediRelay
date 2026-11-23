import glob, os

files = glob.glob(r"D:\projets\MediRelay\frontend\src\app\pharmacy\**\*.tsx", recursive=True)
for f in files:
    with open(f, "r", encoding="utf-8") as fh:
        content = fh.read()
    if "<a href" in content and 'from "next/link"' not in content and "from 'next/link'" not in content:
        content = content.replace('"use client";\n', '"use client";\n\nimport Link from "next/link";\n', 1)
    content = content.replace("<a href=", "<Link href=")
    content = content.replace("</a>", "</Link>")
    with open(f, "w", encoding="utf-8") as fh:
        fh.write(content)
    print(f"Updated: {f}")
print("Done")
