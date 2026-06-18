# studiqarch — Profil-Architektur v2

*Abgeleitetes Domänen-Profil auf dem **lakearch-Kernel v4** (siehe `../../lakearch/semantics/arch4.md`).*

**studiqarch-v2 ersetzt v1.** Neu in v2: die **Profil-Politiken** zu den drei Kernel-Prozessen, die in arch4 §11–§13 gelöst wurden (Identitäts-Auflösung, Materialisierung, Zugriff). Erinnerung an die Schichtung: Kernel = Mechanik (domänen-übergreifend), studiqarch = Politik (lern-spezifisch), beide nach der Governance-Regel getrennt.

Domäne: **Lernen / Klausurvorbereitung.** studiqarch ist die erste Forcing-Function für lakearch.

---

## 1. Kernthese: Das Lernmodell ist das Produkt — nicht die Kartei

studiq führt pro Lernendem ein **lebendes Wissensmodell**: einen **Konzeptgraphen** + ein **Mastery-Profil**. Karten, Quiz, Lernplan, Zusammenfassung sind **Projektionen** darauf, nicht die Sache selbst. Der Konzeptgraph *ist* ein lakearch-Graph (Konzept = Daten, Beziehung = Kontext).

## 2. Vokabular (als Daten)

- **Typen:** `Konzept` (referenzielle Identität → Klassen-Knoten, arch4 §11.1), `Quelle`, `Karte`, `Abruf-Versuch` (Attempt), `Modul` (weiches Objektiv), `Probeklausur`/`Prüfungsaufgabe`.
- **Relationen:** `stammt-aus`, `prüft`, `betrifft`, `setzt-voraus`, `teil-von`, `widerspricht`, `wird-geprüft-in`.
- **Kategorie** (degradierte CrashVault-Taxonomie: Foliensatz/Mitschriften/Cheatsheets/Übungen/Probeklausuren/Klausurvorbereitung/Notizen/Quellen) = `kategorie`-Kontext **an der Quelle** (Provenienz), nicht primäres Ordnungssystem.
- **Identitäts-Grade:** vom Kernel geerbt; studiq nutzt v. a. den Korrelations-Pfad beim Ingest.
- **Mastery = Projektionsname**, kein Typ (siehe §6).

## 3. Der Lern-Loop, projiziert auf lakearch

Capture (neue `Quelle`) → Classify (`kategorie` + Konzept-Extraktion, KI mit Konfidenz/Resolver/Zeit) → Organize (Korrelations-Pfad + gradierte Identität, Auflösung beim Lesen) → Enrich (`Karte`/`prüft`) → Review (jeder Review = `Abruf-Versuch`; Mastery = Projektion; Anki = Export) → Collaborate (fremder Graph via Korrelations-Pfad + Scopes).

## 4. Lern-Prinzipien diktieren die Architektur

Retrieval Practice → `Abruf-Versuch` als Daten · Spacing → bitemporale Gültigkeitszeit · Prerequisites → `setzt-voraus` als Diagnose-Traversal · Generation Effect → offene Wette (§8 D) · Metakognition → Probeklausuren kalibrieren.

## 5. Neubewertung von CrashVault

**Behalten (nativ):** KI assistiert/Mensch kuratiert; Audit-Trail (nativ als reifizierte Kontexte); confidence-gesteuerte Aufnahme; deutsch-first, klausurzentriert. **Degradiert:** Taxonomie → Provenienz-Kontext; Modul → weiches Objektiv; Anki → Export. **Verworfen:** Tiles/Canvas (UI-Artefakt); plain-JSON+SHA-Store (→ lakearch-Kernel).

## 6. Modul als weiches Objektiv

`Modul` ist ein Cluster-/Linsen-Kontext, kein Kasten; ein Konzept kann zu mehreren Modulen gehören; „Modul-Ansicht" = Projektion (Filter über `gehört-zu-modul`).

---

## 7. Profil-Politiken zu den Kernel-Prozessen (vormals „die 5 Risse")

Die Mechanik liegt im Kernel (arch4 §11–§13). Hier die **studiq-Politik** — die konkreten Werte/Kriterien, die studiq in die Kernel-Erweiterungspunkte einsetzt.

### 7.1 Identitäts-Auflösung (arch4 §11)
- **Konzept-Anker:** Jedes mehrfach belegte Konzept bekommt einen Klassen-Knoten; **Karten/Mastery/Plan hängen am Anker**, nie an einem Repräsentanten.
- **Clustering-Schwellen (Startwerte, kalibrierbar):** `verwandt_mit` ab ~0.80 (anzeigen, „bestätigen?"); automatische Klassen-Zusammenlegung erst ab ~0.95; darunter getrennt lassen. **Keine transitive Closure** — Cut-Clustering.
- **Split-Kriterium:** widerspricht eine höher-vertraute Quelle oder eine menschliche Korrektur, wird die Klasse geteilt.

### 7.2 Resolver-Vertrauensränge (arch4 §11.3)
Startordnung (absteigend), kalibrierbar:
1. **Mensch (Lernender/Lehrender)** — selten, autoritativ, haftet.
2. **Offizielle Quellen mit Lösung** — Lösungsschlüssel, geprüfte Probeklausuren.
3. **Foliensatz** (Dozent).
4. **Mitschriften / Cheatsheets.**
5. **KI-Extraktion aus klarem Text.**
6. **KI-Vermutung** (Bild ohne OCR, Dateiname).

### 7.3 Kuratierung via DevLab-Runner (arch4 §11.4)
- Hintergrund-Runner (über DevLab orchestriert) legen Dubletten-Klassen zusammen und **verbergen** Müll (tote Karten, leere Konzepte) — **reversibel**, nie löschend.
- **Konservativ starten:** nur hoch-konfidente Merges (≥0.95), alles ein Klick rücknehmbar; idempotent & konvergent.
- Physisches Löschen (Compaction) bleibt seltene, gesonderte Operation.

### 7.4 Checkpoint-Politik (arch4 §12)
- **Was:** pro Konzept-Anker die **SR-Parameter** (Stabilität, letzte Wiederholung, Schwierigkeit) — **nicht** die abgeleitete Mastery-Prozentzahl.
- **Kadenz:** ein neuer Checkpoint nach jeder Lern-Session (+ bei Bedarf nach Merge/Split-Invalidierung).
- **Live-Mastery** = Checkpoint + Vergessenskurve über verstrichene Zeit (billig).
- **SR-Algorithmus:** noch zu wählen (§8 B-neu).

### 7.5 Zugriff (arch4 §13)
- **Scopes:** Vault als Scope-Label; Modul kann über Vaults geteilt sein (mehrere Scopes pro Daten).
- **Rechte:** `lesen` / `schreiben` / `besitzen` (Owner verwaltet Grants).
- **Geteilte Konzepte:** ein geteilter Klassen-Knoten, dessen private Repräsentanten beim Lesen pro Scope gefiltert werden (filter-before-resolve — kein Leak privater Quellen).

## 8. Offene Entscheidungen (studiq-spezifisch)

- **B — Sequencing:** Kernel-zuerst (mit studiq als Schleifstein) — *bestätigt*.
- **C — Richtung:** bottom-up von Lern-Prinzipien — *Tendenz bestätigt*.
- **D — Generation-Effect-Wette:** KI-Rohentwürfe-zum-Überarbeiten vs. rein menschliches Authoring — **offen**.
- **SR-Modell:** SM-2 / FSRS / eigenes — **offen**.
- **Konzept-Granularität, Karten-/Abfrageformen, Prerequisite-Quelle, Co-Learning-Semantik** — **offen** (siehe Completeness-Analyse).

## 9. Zusammenfassung in einem Satz

studiqarch ist ein lakearch-Profil, das Lernen als lebendes Wissensmodell fasst (Konzeptgraph + Mastery-Profil, Karten/Quiz/Plan als Projektionen), in dem jeder Review ein Abruf-Versuch-Daten ist, Konzepte über Klassen-Anker stabil bleiben, Konflikte nach Quellvertrauen entschieden werden, Aufräumen reversibel im Hintergrund läuft und Zugriff scope-basiert vor jeder Auflösung gefiltert wird.
