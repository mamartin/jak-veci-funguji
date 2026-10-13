# Jak věci fungují

Články s interaktivními modely.

## Co kde je

- `index.html` je rozcestník se všemi tématy.
- `domacnost/`, `technika/`, `doprava/`, `priroda/`, `lidske-telo/` a `vesmir/` jsou kategorie. `index.html` v každé z nich je stránka kategorie se seznamem článků.
- `<kategorie>/<název>/index.html` jsou články. Každý je samostatná stránka s vlastním stylem a skriptem.
- `style.css`, `app.js` a `feedback.js` jsou společné pro rozcestník, kategorie i články.
- `app.js` se stará o chování webu jako aplikace: instaluje service worker, nabízí novou verzi, pamatuje si přečtené články a pozici čtení (vše jen v prohlížeči čtenáře).
- `feedback.js` vkládá dva formuláře: zpětnou vazbu pod článek a pod rozcestník, a nápad na nový článek tam, kde stránka má `<div data-form="napady"></div>` (rozcestník a stránky kategorií).
- `fonts/` jsou písma hostovaná u nás, aby šla uložit pro čtení bez připojení.
- `manifest.webmanifest`, `icon.svg` a PNG ikony dělají z webu aplikaci, kterou jde přidat na plochu telefonu.
- `api/` jsou funkce, které odpovědi z formulářů ukládají, `admin/` je jejich administrace.
- `scripts/` je server pro lokální zkoušení a build service workeru.

## Web jako aplikace (PWA)

Service worker `sw.js` se negeneruje ručně: při nasazení ho z šablony `scripts/sw.template.js` vyrobí `scripts/build.mjs` (Vercel spouští `buildCommand` z `vercel.json`, lokálně `npm run build`). Do šablony doplní seznam všech stránek, stylů a písem s otiskem obsahu. Při první návštěvě se celý web uloží do telefonu a dál se načítá odtud, takže funguje i bez připojení. Po změně libovolného souboru se změní i `sw.js`, prohlížeč stáhne jen změněné soubory a stránka nabídne tlačítko *Aktualizovat*. Lokální server skládá `sw.js` za běhu.

Nový článek potřebuje kartu na rozcestníku a na stránce své kategorie a odkaz v seznamu témat na rozcestníku.

Články dřív ležely přímo v kořeni webu a pak ve složce `clanky/`. Staré adresy (`/zamek/`, `/clanky/zamek/`) přesměrovává `vercel.json` na nové (`/domacnost/zamek/`).

Web běží na Vercelu na adrese <https://jak-veci-funguji.vercel.app>. Každý commit do větve `main` se nasadí sám. Vedle stránek jsou ve složce `api/` dvě funkce, které přijímají zpětnou vazbu čtenářů a ukládají ji jako soubory JSON do úložiště Vercel Blob. Stránka `admin/` odpovědi po zadání hesla zobrazí.

## Nastavení na Vercelu

1. Projekt je připojený k tomuhle repozitáři, **Root Directory** je prázdný.
2. V levém menu projektu Storage: úložiště **Blob** s přístupem **Private**, připojené k projektu.
3. V levém menu projektu Environment Variables: `ADMIN_PASSWORD` (aspoň 8 znaků).
4. Po změně nastavení znovu nasadit (Deployments → Redeploy), jinak se neprojeví.

## Lokální zkoušení

```bash
npm run dev
```

Web i funkce běží na `http://localhost:8787`, odpovědi se ukládají do složky `.data`. Heslo do administrace si server vezme ze souboru `.env.local` (`ADMIN_PASSWORD=…`).
