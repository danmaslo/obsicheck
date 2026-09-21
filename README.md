# Obsicheck

Plugin pro Obsidian, který sbírá checkboxy ze všech Markdown poznámek ve vaultu do jednoho přehledu.

- Úkoly seskupené podle zdrojové poznámky, ve stejném pořadí jako v poznámce.
- Hledání podle textu úkolu nebo cesty poznámky.
- Filtry **Nedokončené**, **Hotové** a **Všechny**.
- Zaškrtnutí i opětovné otevření úkolu přímo v přehledu.
- Kliknutí na text úkolu otevře zdrojovou poznámku na příslušném řádku.
- Automatická aktualizace po změně, vytvoření, smazání či přejmenování poznámky.
- Používá barvy aktuálního tématu. Bez síťových požadavků a externích služeb.

## Instalace přes BRAT

1. V nastavení BRAT zvol **Add beta plugin**.
2. Zadej `danmaslo/obsicheck` nebo `https://github.com/danmaslo/obsicheck`.
3. Vyber nejnovější verzi a potvrď přidání pluginu.
4. Otevři příkaz **Obsicheck: Otevřít přehled úkolů** nebo klikni na ikonu seznamu s fajfkami v levé liště.

Aktualizace můžeš spravovat přes BRAT. Soubory pro instalaci jsou dostupné v [GitHub Releases](https://github.com/danmaslo/obsicheck/releases).

## Ruční instalace

1. Stáhni z [release 0.1.0](https://github.com/danmaslo/obsicheck/releases/tag/0.1.0) a rozbal `obsicheck-0.1.0.zip` do `<vault>/.obsidian/plugins/`. Výsledkem má být složka `obsicheck` se soubory `main.js`, `manifest.json` a `styles.css`.
2. Restartuj Obsidian nebo znovu načti aplikaci.
3. V **Nastavení → Komunitní pluginy** povol **Obsicheck**. Pokud máš zapnutý omezený režim, je potřeba ho pro použití komunitních pluginů vypnout.
4. Klikni na ikonu seznamu s fajfkami v levé liště, nebo spusť příkaz **Obsicheck: Otevřít přehled úkolů**.

Plugin prohledává aktuální vault, ne ostatní vaulty. Poznámky nemusíš přesouvat ani označovat tagem.

```markdown
- [ ] Nakoupit
- [x] Odeslat nabídku
  - [ ] Doplnit přílohu
```

## Chování první verze

- Zobrazuje skutečné checkboxy rozpoznané Markdown parserem Obsidianu; příklady v blocích kódu se do přehledu nezařazují.
- `[x]` a `[X]` znamenají hotovo. Ostatní stavy (např. `[/]`) se zobrazí jako nedokončené s původní značkou. Dokončení nastaví `[x]`, opětovné otevření `[ ]`.
- Text úkolu se zobrazuje jako prostý text, včetně Markdown značek. Kliknutí otevře zdroj; odkazy uvnitř textu zatím nejsou samostatně klikatelné.
- Při souběžné změně poznámky plugin odmítne zápis ze starého přehledu a požádá o opětovné zaškrtnutí. Nemění ostatní obsah ani konce řádků.
- Seznam se obnovuje po zpracování změny Markdown cache Obsidianu; při psaní může mít krátké zpoždění.

## Vývoj

```sh
npm ci
npm run dev
```

Produkční sestavení a testy:

```sh
npm run build
npm test
```

Pro ruční instalaci po sestavení zkopíruj `main.js`, `manifest.json` a `styles.css` do `<vault>/.obsidian/plugins/obsicheck/`.

Testy ověřují extrakci na základě pozic z Markdown cache a bezpečné úpravy checkboxů, včetně duplicitních úkolů, souběžných změn, Unicode a různých konců řádků. Integraci s aplikací je potřeba ověřit přímo v Obsidianu.

### Ruční ověření v Obsidianu

1. Vytvoř dvě poznámky s otevřenými, hotovými a vnořenými checkboxy; přidej příklad checkboxu do bloku kódu.
2. Otevři přehled a ověř seskupení, hledání a všechny tři filtry. Příklad z kódu se nemá zobrazit.
3. Dokonči úkol v přehledu a zkontroluj změnu původní poznámky. Přes filtr Hotové ho znovu otevři.
4. Uprav úkol v poznámce, přidej další, přejmenuj poznámku i složku a poznámku smaž. Přehled má změny převzít.
5. Otevři zdroj kliknutím na text úkolu a zkontroluj cílový řádek.
6. Vypni a znovu zapni plugin; přehled musí znovu načíst aktuální úkoly.

Implementace vychází z [oficiálního vzoru pluginu](https://github.com/obsidianmd/obsidian-sample-plugin) a používá [Vault.process()](https://docs.obsidian.md/Plugins/Vault) pro bezpečnou úpravu aktuálního obsahu poznámek.
