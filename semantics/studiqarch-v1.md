# studiqarch — Profil-Architektur v1

*Abgeleitetes Domänen-Profil auf dem **lakearch-Kernel v3** (siehe `../../lakearch/semantics/arch3.md`).*

Dieses Dokument beschreibt das **Datenmodell-Profil** von studiq — die Begriffe und Regeln, *mit* denen studiq denkt. Es ist **keine** Technologie-Spezifikation und **kein** UI-Entwurf.

**Stellung im Schichtenmodell (lakearch §8):** studiqarch ist *kein* Code-Subtyp und erweitert lakearch *nicht*. Es lebt **als Daten in einem lakearch-Store** und besteht aus Vokabular (Typ-/Relations-Daten), Konventionen (genutzte Identitäts-Grade & Aufnahme-Pfade), Config (Resolver-Schwellen, Projektions-Definitionen) und ggf. registrierten Erweiterungen an Kernel-Erweiterungspunkten. Es gilt die **Governance-Regel** (lakearch §9): neues Vokabular ins Profil, neue Primitive in den Kernel.

Domäne: **Lernen / Klausurvorbereitung.** studiqarch ist die erste Forcing-Function (Schleifstein) für den lakearch-Kernel.

---

## 1. Kernthese: Das Lernmodell ist das Produkt — nicht die Kartei

Die Vorgänger (BWL_Ult = Datei-Vault, CrashVault = Kartei-Cockpit) behandelten die App als Aktenschrank + Karten-Werkbank. studiq dreht das um:

> studiq führt pro Lernendem ein **lebendes Wissensmodell** — einen **Konzeptgraphen** + ein **Mastery-Profil**. Karten, Quiz, Lernplan, Zusammenfassung sind **Projektionen** auf dieses Modell, nicht die Sache selbst.

Der Konzeptgraph *ist* ein lakearch-Graph (Konzept = Daten, Beziehung = Kontext). Damit fallen mehrere CrashVault-Lücken weg: KI erzeugt Wissensstruktur (nicht nur Datei-Ablage), semantische Verknüpfung ist nativ, Planung über Zeit ist nativ, Co-Learning ist Graph-Merge.

## 2. Vokabular (als Daten im Store)

**Typen** (jeweils ein Daten, auf das Instanzen ihren `typ`-Kontext richten):
- `Konzept` — eine lernbare Wissenseinheit. *Achtung:* „das Konzept" ist nach lakearch ein Identitäts-Cluster, kein fester Knoten → siehe Riss R1 (§7).
- `Quelle` — ingestiertes Rohmaterial (PDF, Folien, Mitschrift, Probeklausur, NotebookLM-Paste, …).
- `Karte` — eine Abfrageform für ein Konzept (Front/Back oder reicher).
- `Abruf-Versuch` (Attempt) — ein aktiver Recall-Versuch mit Ergebnis. **Erstklassig**, weil Retrieval Practice das Kernsignal ist.
- `Modul` — **weiches Objektiv**, kein harter Container (siehe §6). Cross-Modul-Konzepte sind dadurch nativ.
- `Probeklausur` / `Prüfungsaufgabe` — kalibriert Prüfungsrelevanz und Mastery.

**Relationen** (Kontext-Typen):
- `stammt-aus` (Konzept → Quelle) · `prüft` (Karte/Aufgabe → Konzept) · `betrifft` (Versuch → Karte)
- `setzt-voraus` (Konzept → Konzept, Prerequisite) · `teil-von` · `widerspricht` · `wird-geprüft-in` (Konzept → Probeklausur)

**Kategorie als Provenienz-Kontext (degradierte CrashVault-Taxonomie):** Foliensatz / Mitschriften / Cheatsheets / Übungen / Probeklausuren / Klausurvorbereitung / Notizen / Quellen sind **kein** primäres Ordnungssystem mehr, sondern ein `kategorie`-Kontext **an der Quelle** (Herkunfts-/Verbindlichkeits-Attribut). Primäre Struktur ist der Konzeptgraph.

**Identitäts-Grade:** vom Kernel geerbt (`deckungsgleich`, `verwandt_mit`, `widerspricht_in`, `bekanntermaßen_verschieden`, …). studiq nutzt v. a. den **Korrelations-Pfad** beim Ingest aus mehreren Quellen.

**Mastery ist KEIN Typ, sondern ein Projektionsname:** „Mastery von Konzept K zum Zeitpunkt T" = Lese-Projektion über alle Abruf-Versuche an Karten, die K prüfen, unter Gültigkeitszeit ≤ T, mit angewandter Vergessenskurve. Nichts Gespeichertes (vorbehaltlich R2).

## 3. Der Lern-Loop, projiziert auf lakearch

Der gemeinsame Loop aus BWL_Ult/CrashVault, neu aufgeladen:

| Phase | lakearch-Operation |
|---|---|
| **Capture** | neue `Quelle`-Daten (Content-Hash, Dedup gratis) |
| **Classify** | Resolver schreibt `kategorie`-Kontext + extrahiert Konzept-Kandidaten; KI-Urteil mit Konfidenz/Resolver/Zeit (Audit nativ) |
| **Organize** | Korrelations-Pfad: Konzepte je Quelle eigenständig + gradierte Identitäts-Kontexte; Auflösung beim Lesen (Schwelle = Profil-Config) |
| **Enrich** | `Karte`/`prüft`-Kontexte; ggf. KI-Rohentwürfe (offene Wette D, §8) |
| **Review** | jeder Review = `Abruf-Versuch`-Daten; Mastery = Projektion; Anki nur noch **Export** |
| **Collaborate** | fremder Graph kommt über Korrelations-Pfad rein, verbunden über gradierte Identität; Sichtbarkeit = offen (R4) |

## 4. Lern-Prinzipien diktieren die Architektur

Bewusst „von der Sache des Lernens her" hergeleitet:
- **Retrieval Practice / Testing Effect** → Review ist aktiver Abruf mit Ergebnis → `Abruf-Versuch` als Daten; Mastery ist Projektion darüber.
- **Spacing Effect** → Scheduling pro Konzept über Zeit → bitemporale Gültigkeitszeit ist Pflicht, nicht Luxus.
- **Prerequisite Structure** → `setzt-voraus`-Kanten sind funktional: Lücken-Diagnose („du scheiterst an X, weil Voraussetzung Y fehlt") = Graph-Traversal.
- **Generation Effect** → offene Wette: KI-Rohentwürfe zum aktiven Überarbeiten vs. rein menschliches Authoring (§8 D).
- **Metakognition/Kalibrierung** → Probeklausuren kalibrieren das Modell; schöne Symmetrie zur gradierten Konfidenz des Resolvers.

## 5. Neubewertung von CrashVault (vollständig überschreibbar)

CrashVault-Entscheidungen sind Hypothesen, die sich Evidenz verdient haben — behalten nur, was eine Neuherleitung übersteht:
- **Behalten (jetzt nativ):** KI assistiert / Mensch kuratiert; Audit-Trail jeder KI-Aktion (in lakearch nativ als reifizierte Kontexte); Confidence-gesteuerte Aufnahme; deutsch-first, klausurzentriert.
- **Degradiert:** 8-Kategorien-Taxonomie → Provenienz-Kontext an der Quelle; „Modul" (harter Container) → weiches Objektiv/Cluster; Anki (Review-Engine) → reiner Export.
- **Verworfen / aus dem Datenmodell raus:** Tiles/Canvas (reines CrashVault-UI-Artefakt); plain-JSON-Store mit SHA-Locking (ersetzt durch lakearch-Kernel; Simplizität wandert in die Lese-Projektionen).

## 6. „Modul" als weiches Objektiv (Designnotiz)

Mathe in BWL, Statistik in Psychologie: Konzepte gehören real zu mehreren Modulen. Daher ist `Modul` ein häufiger Cluster-/Linsen-Kontext, kein Kasten. Ein Konzept kann zu mehreren Modulen gehören; „Modul-Ansicht" ist eine Projektion (Filter über `gehört-zu-modul`-Kontexte), kein Besitzverhältnis.

## 7. Die 5 Risse — studiq-Sicht (Lösungsansätze folgen im nächsten Schritt)

Spiegel zu lakearch §11.2; hier die studiq-spezifische Ausprägung. **Noch ungelöst — der Nutzer liefert als Nächstes seine ersten Lösungsansätze.**

- **R1 — Anker.** studiqs UX hängt an einem stabilen „WCM", an das Karten/Mastery/Plan hängen. lakearch gibt nur einen flüssigen Cluster. Was passiert bei Merge/Un-Merge mit angehängten Karten? Braucht studiqarch einen Konzept-Anker?
- **R2 — Mastery-Performance.** Mastery als Projektion über tausende Versuche × Konzepte bei jedem App-Start — muss schnell *und* frisch sein, ohne Append-only zu verraten.
- **R3 — Resolver-Vorrang.** Menschliche Korrektur am Graphen muss haften, auch wenn ein späterer KI-Lauf widerspricht.
- **R4 — Sichtbarkeit.** Mein Vault / dein Vault / geteilte Module: Zugriffsgrenzen fehlen im lakearch-Modell.
- **R5 — Kuratierung.** Der Lerngraph sammelt Müll (Halb-Dubletten, tote Karten); „räum auf" unter Append-only.

## 8. Offene Entscheidungen (aus der Session)

- **B — Sequencing:** Kernel-Semantik zuerst (mit studiq als Schleifstein) vs. Kernel + studiqarch gleichzeitig skizzieren.
- **C — Richtung:** bottom-up von Lern-Prinzipien vs. top-down vom Datenmodell. *(Tendenz: bottom-up — §4 zeigt, wie sauber Lernen die Architektur diktiert.)*
- **D — Generation-Effect-Wette:** KI-Rohentwürfe-zum-Überarbeiten vs. rein menschliches Authoring.

## 9. Zusammenfassung in einem Satz

studiqarch ist ein lakearch-Profil (Daten, kein Code-Subtyp), das Lernen als lebendes Wissensmodell fasst — Konzeptgraph + Mastery-Profil —, in dem Karten/Quiz/Plan Projektionen sind, jeder Review ein Abruf-Versuch-Daten ist, Provenienz/Kategorie/Modul zu Kontexten degradieren und fünf benannte Risse (Anker, Materialisierung, Resolver-Vorrang, Sichtbarkeit, Kuratierung) als nächstes gelöst werden.
