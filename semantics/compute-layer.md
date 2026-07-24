# Die Rechen-Schicht (Compute-Layer)

*Die Schicht **über** lakearch. Erstes Dokument einer eigenen Ebene zwischen Kernel (`../../lakearch/semantics/lakearch.md`) und Profil (`studiqarch-v2.md`).*

lakearch **speichert, traversiert, matcht** — und sonst nichts (lakearch §1). Jedes Rechnen, Werten und Sortieren liegt hier. Dieses Dokument beschreibt das **Muster** der Rechen-Schicht (weitgehend domänen-allgemein); konkrete Lern-Politik (Schwellen, Modelle, Inbox-Semantik) bleibt in studiqarch.

---

## 1. Rolle und Governance

Die Rechen-Schicht **liest per Traversierung**, **rechnet/wertet/sortiert** und **schreibt ihre Ergebnisse als Daten zurück** (lakearch §1.5, §7, §10). Sie ist die Brücke lakearch ↔ studiqarch.

Sie vervollständigt die Governance-Triade:

> **Vokabular → Profil · Primitiv → Kernel · Berechnung → Schicht darüber.**

Leitsatz (lakearch §7.3): *Aller Zustand liegt in lakearch, alle Berechnung darüber — auch die Berechnung, die entscheidet, wohin neuer Zustand kommt.* Die Entscheidungskriterien liegen als Daten im Bestand; **sie zu lesen ist Traversierung, sie anzuwenden ist Sache dieser Schicht**.

## 2. Der Platzierungs-Agent

Beim Einschleusen neuer Daten ist **append** Sache von lakearch (§7.1); das **Finden des Platzes** (Pfad vom Einhängepunkt bis zum neuen Daten, Wahl an Verzweigungen) ist Sache dieses Agenten (lakearch §7.2). Zwei Regime:

### 2.1 Kontext-reich (der Normalfall)
Das Quellsystem kennt seinen eigenen Einhängepunkt (z. B. studiq verarbeitet eine Vorlesungsunterlage und hängt sie an seinem Datenpunkt ein). Das Netz ist lokal symmetrisch, der Platz ist klar → ein **kleines, lokales Modell** (z. B. ollama auf der GPU des Servers) genügt; das Halluzinationsrisiko ist niedrig, weil alles klar genug ist.

### 2.2 Kontext-arm („Daten, die wir einfach ablegen müssen")
Hier antwortet lakearch ohne neues Primitiv — über den **Korrelations-Pfad** (lakearch §5.7 b):
- Das neue Daten kommt **immer als eigenständiges Daten** herein.
- Ähnlichkeit zu Bestehendem wird **hier oben** berechnet (Embeddings / Vektorsuche = **Ranking = gehört nach oben**, lakearch §1.4).
- Das Ergebnis wird als **gradierter Identitäts-Kontext** zurückgeschrieben (z. B. `verwandt-mit 0.83 → Anker`, lakearch §5.5).

### 2.3 Inbox-Anker
Findet der Agent keinen Platz, hängt das Daten an einen **Auffang-Anker** (Inbox). So ist nichts je wirklich lose — ein Neuron, das selbst Einhängeneuron ist, genügt. Hintergrund-Runner **re-korrelieren** Inbox-Daten später (Kuratierung als reversible Kontexte, lakearch §9.5).

### 2.4 Dynamische Modell-Eskalation
Im Normalfall läuft ein kleines lokales Modell; wird die Platzierung **unklar**, stuft der Agent auf ein größeres Modell hoch (z. B. Claude Sonnet). Pfadsuche ist **explorative Traversierung** (lakearch §1.7 b): sie darf Zyklen nutzen und **zurückgehen** (wenn Pfad A zeigt, dass man vorher anders hätte abbiegen sollen). **Zyklen-Erkennung und Terminierung der explorativen Suche sind Aufgabe dieses Agenten** — nicht von lakearch (dessen mechanische Traversierungen sind ohnehin zyklensicher, §1.7 a).

## 3. Caching = Materialisierung

Teures Wieder-Berechnen wird vermieden, indem Ergebnisse **als Daten materialisiert** werden (lakearch §10): Embeddings und abgeleitete Platzierungen tragen ihre **Herkunft als Kontext**. Ändert sich eine Eingabe, findet die **Rückwärts-Traversierung** die betroffenen Materialisierungen (Invalidierung, §10.3); das Neu-Berechnen löst diese Schicht aus.

## 4. Semantische Chunks

Zerlegung großer Eingaben in semantische Chunks ist **Vorverarbeitung vor dem append** — jeder Chunk wird ein Daten. Chunking ist Berechnung und gehört hierher, nicht in den Kernel.

## 5. Platzhalter-Auflösung

Verweist etwas auf ein noch nicht vorhandenes Daten, steht dort ein **Platzhalter-Daten** (lakearch §3.6). Diese Schicht erkennt eintreffende Daten, die einen Platzhalter erfüllen, und löst ihn über Fortschreibung (lakearch §6.3) oder Korrelation (lakearch §5.7 b) auf.

## 6. Daten-Integrität (Invarianten dieser Schicht)

Zwei Verfassungs-Axiome binden diese Schicht unmittelbar. Beide ruhen auf lakearch-Primitiven; dieses Dokument nennt die Pflicht, ohne die Mechanik des Kernels zu wiederholen.

### 6.1 Passiver Speicher
lakearch ist ein reiner, passiver Speicher: er hält Daten, ohne sie zu deuten, zu bewerten oder eigene Logik auszuführen (lakearch §1.4). **Diese Schicht ist der einzige Ort der Auswertung.** Jedes Ranking, jede Ähnlichkeit, jede Eskalations- und Platzierungswahl (§2), jedes Chunking (§4) entsteht hier und kehrt nur als **fertiges, träges Ergebnis-Daten** in den Speicher zurück. Die Caching-Materialisierung (§3) trägt ihre Herkunft als Kontext (lakearch §10.2); der Speicher **rechnet sie nie selbst nach**. Die *Erkennung* betroffener Materialisierungen bei geänderter Eingabe ist mechanisches Matching im Kernel (Rückwärts-Traversierung, lakearch §10.3 / §1.7 a); das *Neu-Berechnen* löst diese Schicht aus (§3). So wandert kein Auswertungsschritt je in den Speicher.

### 6.2 Atomare Zugriffe
Jeder Datenzugriff — lesend wie schreibend — ist unteilbar und ohne beobachtbaren Zwischenzustand.
- **Einzel-append** (der Normalfall der Platzierung, §2) ist als ein Schreibvorgang von sich aus atomar (lakearch §7.1).
- **Mehr-Daten-Rückgabe** wird **gemeinsam durch ein einziges abschließendes Aktiv-Schreiben sichtbar** (lakearch §13): eine Re-Korrelation, die Inbox-Daten neu einhängt (§2.3); eine invalidierungs-getriebene Neu-Berechnung mehrerer abgeleiteter Daten (§3); eine Platzhalter-Auflösung samt Verbindung (§5). Bis der Aktiv-Marker gesetzt ist, gelten die Teile als inaktiv; Traversierung ignoriert sie.
- **Folge für das Lesen:** Eine Projektion sieht daher stets einen konsistenten Schnappschuss, nie eine halb vollzogene Umstrukturierung. Read-Atomarität ist keine zusätzliche Maschinerie, sondern die Kehrseite des Aktiv-Markers.

## 7. Abgrenzung

- **Generisch (hier):** Platzierungs-Agent, Korrelations-/Inbox-Muster, Modell-Eskalation, Caching-via-Materialisierung, Chunking, Daten-Integrität (Passiver Speicher · atomare Schreib-Rückgabe, §6).
- **Domänen-spezifisch (→ `studiqarch-v2.md` §7):** konkrete Clustering-Schwellen, Vertrauensränge, welche Modelle, Checkpoint-Kadenz, Vault-Scopes, DevLab-Runner.
- **Niemals hier:** Speichern/Traversieren/Matchen — das ist und bleibt lakearch.
