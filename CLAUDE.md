# studiq

Der ernsthafte Nachfolger der historischen Prototypen **BWL_Ult** (Datei-Vault, `~/BWL_Ult`) und **CrashVault** (Lern-Cockpit, `~/CrashVault`). Ziel: ein ultimativer KI-Lern-Assistent, -Organisator und -Kollaborator; holistic service.

**Status:** Konzeptionsphase. Noch kein Code — wir entwerfen zuerst den standardisierten Lernworkflow und das Datenmodell.

## Architektur-Entscheidung (Kern)

studiq baut auf **lakearch** (`~/lakearch`) als Datenmodell — einem minimalistischen, append-only, bitemporalen Ein-Entitäts-Modell. Drei Schichten:

- **lakearch = Kernel** (domänen-rein, wiederverwendbar) → `~/lakearch/semantics/arch3.md`
- **studiqarch = Profil** (Lern-Domäne, als Daten ausgedrückt) → `semantics/studiqarch-v1.md`
- **studiq = App**

Governance-Regel: *Vokabular ins Profil, Primitiv in den Kernel.* lakearch wird domänen-rein gehalten, studiq ist der Schleifstein, der den Kernel an echten Lern-Anforderungen schärft.

## Verzeichnis `semantics/`

Hält die **Bedeutung/Architektur** von studiqarch (nicht die technologische Umsetzung). Aktuelle Version: `studiqarch-v1.md`.

## Offene Arbeit

Fünf „Risse" (lakearch §11.2 / studiqarch §7) sind als nächstes zu lösen: Anker, Materialisierung von Projektionen, Resolver-Vorrang, Sichtbarkeit/Mandanten, Kuratierung unter Append-only.
