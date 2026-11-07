# fara Trezor – postavljanje

Tri načina, od najlakšeg:

## 1) Samo GitHub Pages (bez računa, podaci na uređaju)
Ubaci u repozitorij: `index.html style.css app.js pdf.js config.js pdfmake.bundle.js`.
Settings → Pages → Deploy from a branch → `main` / root.
Na ekranu za ulaz izaberi **„Samo ovaj uređaj“**. Između uređaja prebacuješ šifrovani backup (.json).

## 2) GitHub Pages + Cloudflare Worker (račun i sinhronizacija, besplatno, bez servera)
Stranica ostaje na GitHubu, a prijavu i čuvanje šifrovanog trezora radi besplatni Cloudflare Worker.

1. Napravi besplatan račun na cloudflare.com (ne traži karticu).
2. **Storage & databases → KV → Create** namespace, npr. `fara-trezor`.
3. **Workers & Pages → Create → Create Worker** → daj mu ime (npr. `fara-trezor`) → **Deploy** → **Edit code**.
   Obriši sav kod, zalijepi cijeli sadržaj fajla `worker.js` i klikni **Deploy**.
4. Worker → **Settings → Bindings → Add → KV namespace**: Variable name mora biti tačno `KV`, izaberi svoj namespace → Save.
5. Worker → **Settings → Variables and Secrets → Add** (tip „Text“):
   - `ALLOW_ORIGIN` = adresa tvog sajta, **samo adresa bez putanje**, npr. `https://tvojeime.github.io`
   - (opciono) `INVITE_CODE` = tvoj tajni kod koji se traži pri registraciji
6. Kopiraj adresu Workera (npr. `https://fara-trezor.tvojeime.workers.dev`) i upiši je u **`config.js`**:
   `window.FARA_API = 'https://fara-trezor.tvojeime.workers.dev';`
   Zatim ponovo ubaci `config.js` na GitHub.
7. Otvori sajt → **Registracija**. Čim napraviš svoj račun, u Workeru dodaj varijablu `REGISTRATION` = `closed`, da se niko drugi ne može registrovati.

Provjera: otvori `https://tvoj-worker.workers.dev/api/health`. Treba da vidiš `{"ok":true,...}`.

Napomene: besplatni plan ima ograničenja (npr. do ~1000 upisa dnevno u KV), što je dovoljno za lične potrebe. Ako imaš puno velikih slika u prilozima, trezor može postati prevelik za besplatni plan.

## 3) Vlastiti Node server
`node server.js` (Node 18+, bez paketa) služi i sajt i API, podatke čuva u `data/`. Treba HTTPS i trajni disk.
Promjenljive: `PORT`, `DATA_DIR`, `INVITE_CODE`, `REGISTRATION=closed`, `TRUST_PROXY=1`, `ALLOW_ORIGIN`.

## Sigurnost u kratko
- Glavna šifra se nikad ne šalje. Iz nje se na uređaju izvode dva odvojena dijela: ključ za šifrovanje (ostaje na uređaju) i dokaz za prijavu.
- Server/Worker čuva samo šifrovani trezor. Ako izgubiš glavnu šifru, niko ne može vratiti podatke.
- Dvostepena prijava (TOTP) s kodovima za oporavak, popis uređaja, odjava svih uređaja, zaključavanje nakon pogrešnih pokušaja.
- Ne stavljaj na GitHub backupe (.json), izvezene PDF-ove ni folder `data/`.
