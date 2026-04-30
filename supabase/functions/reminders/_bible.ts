// Versets bibliques thématiques (voyage, entraide, communauté, confiance) — LSG
// Sélection déterministe par jour de l'année.

export interface Verset {
  reference: string;
  texte: string;
}

const VERSETS: Verset[] = [
  {
    reference: "Hébreux 13:2",
    texte:
      "N'oubliez pas l'hospitalité ; car, en l'exerçant, quelques-uns ont logé des anges sans le savoir.",
  },
  {
    reference: "Galates 6:2",
    texte: "Portez les fardeaux les uns des autres, et vous accomplirez ainsi la loi de Christ.",
  },
  {
    reference: "Romains 12:13",
    texte:
      "Contribuez aux besoins des saints. Exercez l'hospitalité.",
  },
  {
    reference: "Actes 2:46",
    texte:
      "Ils étaient chaque jour tous ensemble assidus au temple, ils rompaient le pain dans les maisons, et prenaient leur nourriture avec joie et simplicité de cœur.",
  },
  {
    reference: "1 Pierre 4:9",
    texte: "Exercez l'hospitalité les uns envers les autres, sans murmures.",
  },
  {
    reference: "Philippiens 2:4",
    texte:
      "Que chacun de vous, au lieu de considérer ses propres intérêts, considère aussi ceux des autres.",
  },
  {
    reference: "Matthieu 25:35",
    texte:
      "Car j'ai eu faim, et vous m'avez donné à manger ; j'ai eu soif, et vous m'avez donné à boire ; j'étais étranger, et vous m'avez recueilli.",
  },
  {
    reference: "Luc 6:38",
    texte:
      "Donnez, et il vous sera donné : on versera dans votre sein une bonne mesure, serrée, secouée et qui déborde ; car on vous mesurera avec la mesure dont vous vous serez servis.",
  },
  {
    reference: "Proverbes 17:17",
    texte: "L'ami aime en tout temps, et dans la détresse il se montre un frère.",
  },
  {
    reference: "Psaume 133:1",
    texte:
      "Cantique des degrés. De David. Voici, oh ! qu'il est agréable, qu'il est doux pour des frères de demeurer ensemble !",
  },
  {
    reference: "Jean 13:35",
    texte: "À ceci tous connaîtront que vous êtes mes disciples, si vous avez de l'amour les uns pour les autres.",
  },
  {
    reference: "Éphésiens 4:32",
    texte:
      "Soyez bons les uns envers les autres, compatissants, vous pardonnant réciproquement, comme Dieu vous a pardonné en Christ.",
  },
  {
    reference: "Colossiens 3:14",
    texte: "Mais par-dessus toutes ces choses revêtez-vous de la charité, qui est le lien de la perfection.",
  },
  {
    reference: "1 Jean 4:7",
    texte:
      "Bien-aimés, aimons-nous les uns les autres ; car l'amour est de Dieu, et quiconque aime est né de Dieu et connaît Dieu.",
  },
  {
    reference: "Marc 12:31",
    texte:
      "Et voici le second, qui lui est semblable : Tu aimeras ton prochain comme toi-même. Il n'y a pas d'autre commandement plus grand que ceux-là.",
  },
  {
    reference: "Matthieu 18:20",
    texte: "Car là où deux ou trois sont assemblés en mon nom, je suis au milieu d'eux.",
  },
  {
    reference: "Hébreux 10:24-25",
    texte:
      "Veillons les uns sur les autres pour nous exciter à la charité et aux bonnes œuvres. N'abandonnons pas notre assemblée, comme c'est la coutume de quelques-uns.",
  },
  {
    reference: "Romains 15:7",
    texte:
      "Accueillez-vous donc les uns les autres, comme Christ vous a accueillis, pour la gloire de Dieu.",
  },
  {
    reference: "1 Thessaloniciens 5:11",
    texte:
      "C'est pourquoi, exhortez-vous mutuellement, et édifiez-vous les uns les autres, comme vous le faites déjà.",
  },
  {
    reference: "Galates 5:13",
    texte:
      "Frères, vous avez été appelés à la liberté, seulement ne faites pas de cette liberté un prétexte de vivre selon la chair ; mais rendez-vous, par la charité, serviteurs les uns des autres.",
  },
  {
    reference: "Proverbes 3:5-6",
    texte:
      "Confie-toi en l'Éternel de tout ton cœur, et ne t'appuie pas sur ta sagesse ; reconnais-le dans toutes tes voies, et il aplanira tes sentiers.",
  },
  {
    reference: "Psaume 121:8",
    texte: "L'Éternel préservera ton départ et ton arrivée, dès maintenant et à jamais.",
  },
  {
    reference: "Psaume 91:11",
    texte:
      "Car il ordonnera à ses anges de te garder dans toutes tes voies.",
  },
  {
    reference: "Ésaïe 40:31",
    texte:
      "Mais ceux qui se confient en l'Éternel renouvellent leur force. Ils prennent le vol comme les aigles ; ils courent, et ne se lassent pas ; ils marchent, et ne se fatiguent pas.",
  },
  {
    reference: "Psaume 37:5",
    texte: "Recommande ton sort à l'Éternel, mets en lui ta confiance, et il agira.",
  },
  {
    reference: "Matthieu 5:16",
    texte:
      "Que votre lumière luise ainsi devant les hommes, afin qu'ils voient vos bonnes œuvres, et qu'ils glorifient votre Père qui est dans les cieux.",
  },
  {
    reference: "Romains 12:10",
    texte:
      "Ayez les uns pour les autres une affection fraternelle ; rivalisez d'égards mutuels.",
  },
  {
    reference: "1 Corinthiens 12:25-26",
    texte:
      "Pour qu'il n'y ait pas de division dans le corps, mais que les membres aient également soin les uns des autres. Si un membre souffre, tous les membres souffrent avec lui ; si un membre est honoré, tous les membres se réjouissent avec lui.",
  },
  {
    reference: "Actes 4:32",
    texte:
      "La multitude de ceux qui avaient cru n'était qu'un cœur et qu'une âme. Nul ne disait que ses biens lui appartenaient en propre, mais tout était commun entre eux.",
  },
  {
    reference: "Proverbes 11:25",
    texte: "Celui qui répand des bienfaits sera lui-même béni, car il donne de son pain au pauvre.",
  },
  {
    reference: "Zacharie 7:9",
    texte:
      "Rendez une justice vraie, et pratiquez l'amour et la miséricorde l'un envers l'autre.",
  },
  {
    reference: "Michée 6:8",
    texte:
      "On t'a fait connaître, ô homme, ce qui est bien ; et ce que l'Éternel demande de toi, c'est que tu pratiques la justice, que tu aimes la miséricorde, et que tu marches humblement avec ton Dieu.",
  },
  {
    reference: "1 Jean 3:18",
    texte:
      "Petits enfants, n'aimons pas en paroles et avec la langue, mais en actions et avec vérité.",
  },
  {
    reference: "Luc 10:27",
    texte:
      "Il répondit : Tu aimeras le Seigneur, ton Dieu, de tout ton cœur, de toute ton âme, de toute ta force, et de toute ta pensée ; et ton prochain comme toi-même.",
  },
  {
    reference: "Éphésiens 5:2",
    texte:
      "Marchez dans la charité, à l'exemple de Christ, qui nous a aimés, et qui s'est livré lui-même à Dieu pour nous comme une offrande et un sacrifice de bonne odeur.",
  },
  {
    reference: "Colossiens 3:16",
    texte:
      "Que la parole de Christ habite parmi vous abondamment ; instruisez-vous et exhortez-vous les uns les autres avec toute sagesse.",
  },
  {
    reference: "Psaume 68:20",
    texte: "Dieu est pour nous un Dieu qui sauve ; c'est par l'Éternel, le Seigneur, qu'on échappe à la mort.",
  },
  {
    reference: "Deutéronome 31:8",
    texte:
      "L'Éternel lui-même marchera devant toi, il sera lui-même avec toi, il ne te délaissera point et ne t'abandonnera point.",
  },
  {
    reference: "Josué 1:9",
    texte:
      "Je t'ai donné cet ordre : sois fort et courageux ! Ne te trouble pas et ne t'effraie pas, car l'Éternel, ton Dieu, est avec toi dans tout ce que tu feras.",
  },
  {
    reference: "Psaume 46:2",
    texte:
      "Dieu est pour nous un refuge et un appui, un secours qui ne manque jamais dans la détresse.",
  },
  {
    reference: "Philippiens 4:13",
    texte: "Je puis tout par celui qui me fortifie.",
  },
  {
    reference: "Romains 8:28",
    texte:
      "Nous savons, du reste, que toutes choses concourent au bien de ceux qui aiment Dieu, de ceux qui sont appelés selon son dessein.",
  },
  {
    reference: "Jean 14:27",
    texte:
      "Je vous laisse la paix, je vous donne ma paix. Je ne vous donne pas comme le monde donne. Que votre cœur ne se trouble point, et ne se laisse point effrayer.",
  },
  {
    reference: "Philippiens 4:6-7",
    texte:
      "Ne vous inquiétez de rien ; mais en toute chose faites connaître vos besoins à Dieu par des prières et des supplications, avec des actions de grâces. Et la paix de Dieu, qui surpasse toute intelligence, gardera vos cœurs et vos pensées en Jésus-Christ.",
  },
  {
    reference: "Matthieu 6:33",
    texte:
      "Cherchez premièrement le royaume et la justice de Dieu ; et toutes ces choses vous seront données par-dessus.",
  },
  {
    reference: "1 Pierre 5:7",
    texte: "Déchargez-vous sur lui de tous vos soucis, car lui-même prend soin de vous.",
  },
  {
    reference: "Luc 6:31",
    texte: "Ce que vous voulez que les hommes fassent pour vous, faites-le de même pour eux.",
  },
  {
    reference: "Romains 12:16",
    texte:
      "Ayez les mêmes sentiments les uns envers les autres. N'aspirez pas à ce qui est élevé, mais laissez-vous attirer par ce qui est humble.",
  },
  {
    reference: "Proverbes 27:17",
    texte: "Le fer aiguise le fer, et l'homme aiguise le visage de son ami.",
  },
  {
    reference: "Ecclésiaste 4:9-10",
    texte:
      "Deux valent mieux qu'un, parce qu'ils retirent un bon salaire de leur travail. Car s'ils tombent, l'un relève son compagnon ; mais malheur à celui qui est seul et qui tombe, sans avoir un second pour le relever !",
  },
];

/**
 * Retourne le verset du jour basé sur le numéro du jour dans l'année.
 * Déterministe : même date → même verset.
 */
export const getDailyVerse = (date: Date): Verset => {
  const start = new Date(Date.UTC(date.getFullYear(), 0, 1));
  const dayOfYear = Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - start.getTime()) / 86_400_000);
  return VERSETS[dayOfYear % VERSETS.length];
};
