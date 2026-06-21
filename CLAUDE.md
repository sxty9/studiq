# studiq

Der ernsthafte Nachfolger der historischen Prototypen **BWL_Ult** (Datei-Vault, `~/BWL_Ult`) und **CrashVault** (Lern-Cockpit, `~/CrashVault`). Ziel: ein ultimativer KI-Lern-Assistent, -Organisator und -Kollaborator; holistic service.

**Status:** Konzeptionsphase. Noch kein Code — wir entwerfen zuerst den standardisierten Lernworkflow und das Datenmodell.

## Architektur-Entscheidung (Kern)

studiq baut auf **lakearch** (`~/lakearch`) als Datenmodell — einem minimalistischen, append-only, bitemporalen Ein-Entitäts-Modell. Vier Ebenen:

- **lakearch = Kernel** (domänen-rein, wiederverwendbar; speichert/traversiert/matcht) → `~/lakearch/semantics/lakearch.md`
- **Rechen-Schicht = Berechnung** (rechnet/wertet/sortiert über dem Kernel; Platzierung, Auflösung, Caching) → `semantics/compute-layer.md`
- **studiqarch = Profil** (Lern-Domäne, als Daten ausgedrückt) → `semantics/studiqarch-v2.md`
- **studiq = App**

Governance-Triade: *Vokabular → Profil · Primitiv → Kernel · Berechnung → Schicht darüber.* lakearch wird domänen-rein gehalten, studiq ist der Schleifstein, der den Kernel an echten Lern-Anforderungen schärft.

## Verzeichnis `semantics/`

Hält die **Bedeutung/Architektur** (nicht die technologische Umsetzung): `studiqarch-v2.md` (Profil, aktuell) und `compute-layer.md` (Rechen-Schicht).

## Offene Arbeit

Die fünf „Risse" und die vier Kernel-Nahtstellen (Schreib-Axiom, Bestand-Definition, Platzhalter, Zyklen) sind gelöst und konsolidiert (lakearch.md / compute-layer.md / studiqarch-v2.md). Nächste Agenda — studiq-Pädagogik: Generation-Effekt-Wette, SR-Modell (SM-2/FSRS/eigenes), Konzept-Granularität, Karten-/Abfrageformen, Prerequisite-Quelle, Co-Learning-Semantik; danach der WCM-Dünnschnitt end-to-end als „prove it".
