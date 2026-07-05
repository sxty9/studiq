import {
  CardsIcon,
  ChatIcon,
  ClockIcon,
  LayersIcon,
  ShuffleIcon,
  TargetIcon,
} from '@/ui/icons';

/** A learning technique the LEARN tab offers. The registry (name/copy/icon) is static UI data;
 *  a method's *enabled* flag is per-user state and lives in the DataSource (LearningMethodState),
 *  keyed by this same `id`. `status` gates whether a real method screen exists yet — every method
 *  is a `placeholder` until studiqarch's SR model is decided, so the Screens land later. */
export interface LearningMethod {
  id: string;
  name: string;
  tagline: string;
  blurb: string;
  Icon: (p: { className?: string }) => JSX.Element;
  status: 'ready' | 'placeholder';
}

export const METHODS: LearningMethod[] = [
  {
    id: 'spaced-repetition',
    name: 'Spaced Repetition',
    tagline: 'Wiederholen im perfekten Moment',
    blurb:
      'Karten tauchen genau dann wieder auf, wenn du sie zu vergessen drohst. Wachsende Intervalle verankern Wissen langfristig statt nur für den Moment.',
    Icon: CardsIcon,
    status: 'placeholder',
  },
  {
    id: 'active-recall',
    name: 'Active Recall',
    tagline: 'Abrufen statt nachlesen',
    blurb:
      'Du beantwortest Fragen aus dem Kopf, bevor du die Lösung siehst. Das aktive Abrufen stärkt die Gedächtnisspur weit mehr als erneutes Lesen.',
    Icon: TargetIcon,
    status: 'placeholder',
  },
  {
    id: 'practice-exam',
    name: 'Probeklausur',
    tagline: 'Den Ernstfall proben, bevor er zählt',
    blurb:
      'Übe unter echten Klausurbedingungen – auf Zeit und ohne Hilfsmittel. So gewöhnst du dich an den Druck und deckst Lücken auf, solange sie noch harmlos sind.',
    Icon: ClockIcon,
    status: 'placeholder',
  },
  {
    id: 'feynman',
    name: 'Feynman',
    tagline: 'Erklären, bis es einfach wird',
    blurb:
      'Erkläre ein Konzept in eigenen, einfachen Worten – als lehrtest du es einem Kind. Wo du ins Stocken gerätst, sitzt deine echte Wissenslücke.',
    Icon: ChatIcon,
    status: 'placeholder',
  },
  {
    id: 'elaboration',
    name: 'Elaboration',
    tagline: 'Neues mit Bekanntem verknüpfen',
    blurb:
      'Frage dich beim Lernen ständig „warum“ und „wie hängt das zusammen“. Reichhaltige Verknüpfungen machen Wissen verständlich und leichter abrufbar.',
    Icon: LayersIcon,
    status: 'placeholder',
  },
  {
    id: 'interleaving',
    name: 'Interleaving',
    tagline: 'Themen bewusst mischen',
    blurb:
      'Statt ein Thema am Stück zu pauken, wechselst du gezielt zwischen Aufgabentypen. Das Mischen trainiert, das richtige Vorgehen selbst zu erkennen.',
    Icon: ShuffleIcon,
    status: 'placeholder',
  },
];
