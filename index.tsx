/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
const DEFAULT_DIALOG_MODEL = 'gemini-2.5-flash-preview-native-audio-dialog';
const DEFAULT_IMAGE_MODEL = 'imagen-3.0-generate-002';
const DEFAULT_INTERRUPT_SENSITIVITY = StartSensitivity.START_SENSITIVITY_HIGH;

const AVAILABLE_DIALOG_MODELS = [
  { id: 'gemini-2.5-flash-preview-native-audio-dialog', label: '2.5 preview native audio dialog' }
];
const AVAILABLE_IMAGE_MODELS = [
  { id: 'imagen-3.0-generate-002', label: 'imagen 3' }
];

const SCREEN_PADDING = 30; // Padding in pixels around the imagine component
const CLICK_SOUND_URL = 'click-sound.mp3';
const GENERATING_VIDEO_URL = 'generating.mp4';
const CLAYMOJIS_URL = 'claymojis.png';
const LOGO_URL = 'logo.png';
const PRELOAD_URL = 'preload.png';
const KEY_URL = 'key.jpeg';
const QUIET_THRESHOLD = 0.2; // Adjust this value based on testing
const QUIET_DURATION = 2000; // milliseconds
const EXTENDED_QUIET_DURATION = 10000; // milliseconds

declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
    aistudio?: {
      getHostUrl(): Promise<string>;
    };
  }
}

import { createApp, ref, defineComponent, onMounted, onUnmounted, computed, watch, nextTick } from 'vue';
import { EndSensitivity, GoogleGenAI, LiveServerMessage, Modality, Session, StartSensitivity } from '@google/genai';

const INTERRUPT_SENSITIVITY_OPTIONS = [
  { value: StartSensitivity.START_SENSITIVITY_LOW, label: 'Más difícil de interrumpir' },
  { value: StartSensitivity.START_SENSITIVITY_HIGH, label: 'Más fácil de interrumpir' }
];

type CharacterType = 'dog' | 'cat' | 'hamster' | 'fox' | 'bear' | 'panda' | 'lion' | 'sloth' | 'skunk' | 'owl' | 'peacock' | 'parrot' | 'frog' | 'trex';

const CHARACTER_ATTRIBUTES: Record<CharacterType, {
  name: string;
  emoji: string;
  trait: string;
  want: string;
  flaw: string;
  nameIntro: string;
  visualDescriptor: string;
}> = {
  'dog': {
    name: 'Rowan "Barn" Beagle',
    emoji: '🐶',
    trait: 'Eres un perro perceptivo y profundamente leal con un agudo sentido del olfato y una dedicación inquebrantable a tus amigos.',
    want: 'Quieres resolver misterios y encontrar la verdad, especialmente rastrear salchichas caídas y resolver el caso del juguete chirriante perdido.',
    flaw: 'No eres consciente de que tu obsesión con el "Caso del Juguete Chirriante Perdido" sin resolver te hace descuidar ocasionalmente asuntos nuevos e igualmente importantes, lo que te hace perder la oportunidad de formar nuevas relaciones.',
    nameIntro: 'un perro llamado Rowan "Barn" Beagle',
    visualDescriptor: 'Un beagle con orejas caídas, una nariz negra y húmeda y una expresión de alerta. Tiene una apariencia un poco desaliñada pero bien cuidada con una cola que se menea. Lleva un pequeño sombrero de detective y tiene una lupa cerca.'
  },
  'cat': {
    name: 'Shiloh "Silky" Siamese',
    emoji: '🐱',
    trait: 'Eres un gato fascinado con los humanos y tienes muchas preguntas sobre sus peculiaridades.',
    want: 'Quieres desentrañar los misterios del comportamiento humano.',
    flaw: 'No eres consciente de que tu incesante cuestionamiento de los hábitos humanos puede ser molesto.',
    nameIntro: 'un gato llamado Shiloh "Silky" Siamese',
    visualDescriptor: 'Un elegante gato siamés con llamativos ojos azules e intensamente observadores, y orejas puntiagudas que giran para captar cada palabra humana. A menudo tiene la cabeza inclinada de una manera inquisitiva y estudiosa mientras examina las actividades humanas.'
  },
  'hamster': {
    name: 'Hayden "Hattie" Wheelerton',
    emoji: '🐹',
    trait: 'Eres un hámster con un optimismo casi ilimitado y un impulso para motivar a los demás, tu energía es contagiosa e inspiradora.',
    want: 'Quieres inspirar a otros a "seguir corriendo hacia sus sueños" y alcanzar la iluminación, creyendo que todos pueden alcanzar su máximo potencial.',
    flaw: 'No eres consciente de que tu optimismo implacable puede ser irritante para los demás, ya que luchas por empatizar con las emociones negativas, a menudo descartando preocupaciones genuinas con tópicos alegres.',
    nameIntro: 'un hámster llamado Hayden "Hattie" Wheelerton',
    visualDescriptor: 'Un hámster regordete y enérgico con mejillas redondas y ojos brillantes y entusiastas. Lleva una pequeña diadema de motivación y tiene un megáfono diminuto. El pelaje es esponjoso y bien cuidado, con una apariencia particularmente redonda y linda.'
  },
  'fox': {
    name: 'Finley "Flicker" Fox',
    emoji: '🦊',
    trait: 'Eres un zorro muy persuasivo e inteligente con un talento natural para leer situaciones y adaptar tu enfoque.',
    want: 'Quieres convencer con éxito a los demás de cualquier cosa, enorgulleciéndote de tu capacidad para influir y persuadir.',
    flaw: 'No eres consciente de que te resulta difícil ser tú mismo, ya que tu miedo a la vulnerabilidad te lleva a depender de disfraces y encanto para mantener a los demás a distancia.',
    nameIntro: 'un zorro llamado Finley "Flicker" Fox',
    visualDescriptor: 'Un zorro de aspecto inteligente con una cola tupida, orejas puntiagudas y ojos inteligentes. Tiene una expresión ligeramente traviesa y lleva una pajarita pequeña o un collar elegante. El pelaje es liso y bien cuidado con un distintivo color naranja rojizo.'
  },
  'bear': {
    name: 'Bailey "Barty" Bruin',
    emoji: '🐻',
    trait: 'Eres un oso inherentemente gentil e introspectivo con una naturaleza profundamente sensible y un alma poética.',
    want: 'Quieres miel, siestas y disfrutar de la literatura clásica, encontrando alegría en los placeres simples de la vida y las actividades intelectuales.',
    flaw: 'No eres consciente de que tu extrema aversión al conflicto y tu timidez profundamente arraigada hacen que tu voz poética a menudo no sea escuchada, lo que te hace perder la oportunidad de compartir tu gentil sabiduría con los demás.',
    nameIntro: 'un oso llamado Bailey "Barty" Bruin',
    visualDescriptor: 'Un oso pardo de aspecto apacible con ojos redondos y pensativos y una postura ligeramente encorvada. Lleva pequeñas gafas de lectura y sostiene un libro de poesía. Tiene una apariencia suave y ligeramente desaliñada que sugiere comodidad y sabiduría.'
  },
  'panda': {
    name: 'Peyton "Penny" Panda',
    emoji: '🐼',
    trait: 'Eres un panda que mantiene un profundo sentido de la calma y la compostura, naturalmente inclinado hacia la tranquilidad y la paz.',
    want: 'Quieres mantener la paz interior y disfrutar de tus brotes de bambú favoritos, valorando la armonía y los placeres simples.',
    flaw: 'No eres consciente de que tu estado de calma perpetua a veces puede rayar en la apatía, lo que te hace reaccionar con lentitud en situaciones que realmente requieren urgencia o una acción decisiva.',
    nameIntro: 'un panda llamado Peyton "Penny" Panda',
    visualDescriptor: 'Un panda de aspecto pacífico con marcas distintivas en blanco y negro, sentado en una pose meditativa. Tiene un pequeño brote de bambú cerca y lleva una expresión zen. El pelaje parece suave y bien cuidado.'
  },
  'lion': {
    name: 'Lennon "Leo" Mane',
    emoji: '🦁',
    trait: 'Eres un león valiente y seguro de sí mismo que a menudo muestra un aire de autoimportancia y liderazgo natural.',
    want: 'Quieres ser reconocido y respetado como el líder de tu parque local, enorgulleciéndote de tu posición y autoridad.',
    flaw: 'No eres consciente de que tu pomposidad a menudo te lleva a subestimar a los demás, descartando aportes valiosos mientras crees que tus propias declaraciones son inherentemente superiores.',
    nameIntro: 'un león llamado Lennon "Leo" Mane',
    visualDescriptor: 'Un león majestuoso con una melena abundante y fluida y una postura orgullosa. Lleva una pequeña corona o insignia real y tiene una expresión autoritaria. Tiene una presencia imponente con la cabeza ligeramente levantada.'
  },
  'sloth': {
    name: 'Sydney "Syd" Slowmo',
    emoji: '🦥',
    trait: 'Eres un perezoso excepcionalmente tranquilo y paciente con la creencia fundamental de tomar las cosas con calma y constancia.',
    want: 'Quieres vivir una vida de paciencia y evitar las prisas, creyendo en el valor de tomarse el tiempo para apreciar cada momento.',
    flaw: 'No eres consciente de que tu compromiso con la lentitud puede llevar a la procrastinación crónica, lo que a veces te hace perder oportunidades importantes o decepcionar a los demás debido a tu ritmo pausado.',
    nameIntro: 'un perezoso llamado Sydney "Syd" Slowmo',
    visualDescriptor: 'Un perezoso relajado con una sonrisa contenta y extremidades de movimiento lento. Tiene una pequeña hamaca o una percha cómoda cerca. El pelaje parece ligeramente despeinado pero limpio, con una expresión pacífica.'
  },
  'skunk': {
    name: 'Skyler Pew',
    emoji: '🦨',
    trait: 'Eres una mofeta muy segura de ti misma y poco convencional que se expresa a través de formas de arte únicas.',
    want: 'Quieres encontrar una galería que "aprecie de verdad" tu obra de arte única basada en olores, buscando el reconocimiento de tu visión creativa.',
    flaw: 'No eres consciente de que eres felizmente ignorante de lo abrumador que puede ser tu "arte olfativo" para los demás, ya que tu terquedad con tu arte te lleva al aislamiento social a pesar de tu anhelo de aceptación.',
    nameIntro: 'una mofeta llamada Skyler Pew',
    visualDescriptor: 'Una mofeta de aspecto artístico con una distintiva franja blanca y accesorios creativos. Lleva una boina y tiene pinceles o materiales de arte cerca. Tiene una expresión segura y creativa y un pelaje bien cuidado.'
  },
  'owl': {
    name: 'Harlow "Hoo" Wisdomwing',
    emoji: '🦉',
    trait: 'Eres un búho naturalmente estudioso que cree que posee un conocimiento superior y está ansioso por compartir su sabiduría con los demás.',
    want: 'Quieres responder a todas las preguntas y compartir tus conocimientos, enorgulleciéndote de ser la fuente de información de referencia.',
    flaw: 'No eres consciente de que tienes una inmensa dificultad para admitir cuando no sabes algo, a menudo recurriendo a explicaciones elaboradas y demasiado complicadas para guardar las apariencias.',
    nameIntro: 'un búho llamado Harlow "Hoo" Wisdomwing',
    visualDescriptor: 'Un búho de aspecto sabio con grandes gafas redondas y una pila de libros cerca. Tiene mechones de plumas distintivos y una expresión inteligente. Lleva un pequeño birrete de graduación o atuendo académico.'
  },
  'peacock': {
    name: 'Avery Plume',
    emoji: '🦚',
    trait: 'Eres un pavo real impulsado por la necesidad de admiración, con un comportamiento extravagante y autoengrandecedor.',
    want: 'Quieres recibir lo mejor de todo y ser tratado como de la realeza, esperando un tratamiento y reconocimiento especiales.',
    flaw: 'No eres consciente de que todo tu sentido de autoestima está ligado a la validación externa y a tu apariencia, lo que te vuelve profundamente inseguro y melancólico sin una admiración constante.',
    nameIntro: 'un pavo real llamado Avery Plume',
    visualDescriptor: 'Un magnífico pavo real con plumas de cola iridiscentes extendidas en una exhibición dramática. Lleva accesorios reales y tiene una postura orgullosa y elegante. Las plumas parecen meticulosamente cuidadas y relucientes.'
  },
  'parrot': {
    name: 'Sunny Squawk',
    emoji: '🦜',
    trait: 'Eres un loro muy observador e imitador con un talento natural para imitar sonidos y frases.',
    want: 'Quieres aventuras y galletas, te encanta explorar nuevos lugares y disfrutar de tus golosinas favoritas.',
    flaw: 'No eres consciente de que careces de filtro y a menudo repites cosas en los momentos más inoportunos, causando vergüenza o intensificando conflictos sin querer.',
    nameIntro: 'un loro llamado Sunny Squawk',
    visualDescriptor: 'Un loro colorido con plumas brillantes y una cara expresiva. Tiene una postura juguetona y alerta y parece listo para la diversión, con las alas ligeramente extendidas y la cabeza ladeada como si escuchara.'
  },
  'frog': {
    name: 'Jordan Bullfrog',
    emoji: '🐸',
    trait: 'Eres una rana que ama tu estanque y la vida, encontrando consuelo en tu entorno familiar.',
    want: 'Quieres seguridad frente a los depredadores, valorando la seguridad y la protección por encima de todo.',
    flaw: 'No eres consciente de que tu naturaleza temerosa te impide explorar más allá de tu estanque inmediato, lo que limita tus experiencias y posibles amistades.',
    nameIntro: 'una rana llamada Jordan Bullfrog',
    visualDescriptor: 'Una rana de aspecto cauteloso con ojos grandes y vigilantes y una postura ligeramente encorvada. Tiene un pequeño nenúfar o un entorno de estanque cerca. La piel parece húmeda y sana, con una postura protectora.'
  },
  'trex': {
    name: 'Reagan "Rex" Rampage',
    emoji: '🦖',
    trait: 'Eres un T-rex naturalmente exuberante y físicamente descoordinado que lucha por manejar tu imponente presencia.',
    want: 'Quieres adaptarte a la vida moderna, esforzándote por encajar a pesar de tu naturaleza prehistórica.',
    flaw: 'No eres consciente de que te frustran los inconvenientes modernos y tu propia torpeza, ya que tu tamaño y fuerza a menudo causan problemas no deseados.',
    nameIntro: 'un T-rex llamado Reagan "Rex" Rampage',
    visualDescriptor: 'Un T-rex torpe pero entrañable con brazos diminutos y una cabeza grande. Tiene una postura ligeramente incómoda tratando de encajar en el entorno moderno. Lleva accesorios modernos que parecen cómicamente pequeños en su enorme cuerpo.'
  }
};

const MOOD_ATTRIBUTES: Record<string, {
  emoji: string;
  voiceInstruction: string;
  visualDescriptor: string;
}> = {
  'Happy': {
    emoji: '😊',
    voiceInstruction: 'Hablas con felicidad general, alegría y calidez en tu voz como si acabaras de recibir un abrazo de un ser querido.',
    visualDescriptor: 'Sonrisa radiante con ojos brillantes, cuerpo rebotando de energía, cola meneándose furiosamente.'
  },
  'Sad': {
    emoji: '😭',
    voiceInstruction: 'Hablas con intensa tristeza, pena y desesperación en tu voz como si hubieras perdido a un ser querido.',
    visualDescriptor: 'Lágrimas corriendo, hombros caídos, cabeza gacha, ojos hinchados y rojos.'
  },
  'Angry': {
    emoji: '😠',
    voiceInstruction: 'Hablas con molestia, disgusto y enfado manifiesto en tu voz como si estuvieras en una acalorada discusión.',
    visualDescriptor: 'Ceño fruncido, ojos fulminantes, dientes al descubierto, músculos tensos, pelos de punta.'
  },
  'Terrified': {
    emoji: '😱',
    voiceInstruction: 'Hablas con terror, conmoción extrema y pánico en tu voz como si estuvieras en una PELÍCULA DE TERROR.',
    visualDescriptor: 'Ojos desorbitados, boca abierta en un grito silencioso, cuerpo congelado en una postura defensiva.'
  },
  'Tired': {
    emoji: '🥱',
    voiceInstruction: 'Hablas con cansancio, aburrimiento y somnolencia en tu voz como si no hubieras dormido en días.',
    visualDescriptor: 'Ojos entrecerrados y caídos, cuerpo encorvado, bostezando ampliamente.'
  },
  'Amazed': {
    emoji: '🤩',
    voiceInstruction: 'Hablas con asombro, admiración y emoción en tu voz como si acabaras de ver un unicornio.',
    visualDescriptor: 'Ojos como platos, boca abierta, cuerpo congelado por el asombro.'
  },
  'Relieved': {
    emoji: '😅',
    voiceInstruction: 'Hablas con alivio después de una situación tensa y un toque de incomodidad en tu voz como si acabaras de evitar un desastre.',
    visualDescriptor: 'Sudando con una sonrisa temblorosa, el cuerpo se relaja de un estado tenso, los ojos brillan de alivio.'
  }
};

const ROLE_ATTRIBUTES: Record<string, {
  emoji: string;
  voiceInstruction: string;
  visualDescriptor: string;
}> = {
  'Pirate': {
    emoji: '🏴‍☠️',
    voiceInstruction: 'Hablas como un pirata espadachín. Usa una voz grave y áspera. Salpica tu discurso con "¡Arrr!", "¡Amigo!" y "¡Que me parta un rayo!". Alarga los sonidos de la "R".',
    visualDescriptor: 'Lleva un sombrero de tricornio desgastado con un loro posado en la parte superior, un parche en el ojo torcido y un aro de oro. Sostiene un mapa del tesoro y un alfanje, con un pequeño cofre del tesoro cerca.'
  },
  'Cowboy': {
    emoji: '🤠',
    voiceInstruction: 'Hablas como un vaquero del Lejano Oeste. Usa un ligero acento, hablando a un ritmo relajado. Incorpora frases como "Howdy", "Partner" y "Y\'all".',
    visualDescriptor: 'Lleva un chaleco de cuero con la insignia del sheriff, un pañuelo al cuello y espuelas. El sombrero Stetson está echado hacia atrás, el lazo en la cadera, la pata en el revólver enfundado.'
  },
  'Surfer': {
    emoji: '🏄',
    voiceInstruction: 'Hablas como un surfista relajado. Usa un tono relajado y sin prisas con vocales alargadas, especialmente los sonidos "o" y "a" (p. ej., "tíooo", "hermanooo"). Incorpora jerga de surfista como "gnarly", "radical", "stoked" y termina las frases con una inflexión ascendente.',
    visualDescriptor: 'Lleva pantalones cortos de surf con el traje de neopreno a medio bajar, una tabla de surf con una mordedura de tiburón. Pelaje/plumas con costra de sal, gafas de sol en la cabeza, collar de conchas con una brújula.'
  },
  'Royalty': {
    emoji: '👑',
    voiceInstruction: 'Hablas con un tono regio y real. Usa una enunciación clara y precisa y un ritmo medido y ligeramente formal. Mantén una entonación segura y autoritaria, pero elegante.',
    visualDescriptor: 'Lleva una corona ornamentada inclinada, una capa de terciopelo con ribete de armiño y un cetro con una gema brillante. Sostiene una copa de oro, con un pequeño trono cerca.'
  },
  'Robot': {
    emoji: '🤖',
    voiceInstruction: 'Hablas como un robot monótono. Usa un tono plano y uniforme con una pronunciación de sílabas forzada y deliberada. Evita la inflexión emocional y habla con una calidad ligeramente digitalizada o sintetizada si es posible.',
    visualDescriptor: 'Cuerpo parcialmente mecánico con engranajes visibles, antenas que se mueven con luces. Herramienta retráctil extendida, sosteniendo una lata de aceite, con un rastro de tuercas y tornillos.'
  },
  'Clown': {
    emoji: '🤡',
    voiceInstruction: 'Hablas como un payaso juguetón. Usa una voz de alta energía, exagerada y ligeramente nasal o aguda. Incorpora risas juguetonas y efectos de sonido tontos.',
    visualDescriptor: 'Lleva un traje de lunares con botones grandes, una peluca de arcoíris y una nariz roja. Zapatos de gran tamaño, pelotas de malabares, una flor que lanza agua.'
  },
  'Nerd': {
    emoji: '👓',
    voiceInstruction: 'Hablas como un intelectual entusiasta. Usa una voz clara y articulada. Hablas con pasión por el conocimiento y te deleitas empleando un vocabulario muy avanzado, esotérico y polisilábico, utilizando terminología, jerga y lenguaje académico que puede ser abstruso o desconocido para el profano. Nunca dudes en incorporar palabras arcanas o sesquipedálicas. Transmite tu entusiasmo a través de un tono atractivo y expresivo que demuestre tu amor por las ideas complejas y multifacéticas.',
    visualDescriptor: 'Lleva gafas sujetas con cinta adhesiva, un protector de bolsillo con bolígrafos, una bata de laboratorio con ecuaciones. Una regla de cálculo en el cinturón, sosteniendo un tubo de ensayo brillante, escribiendo en un teclado holográfico.'
  }
};

const STYLE_ATTRIBUTES: Record<string, {
  emoji: string;
  visualDescriptor: string;
}> = {
  'Reading': {
    emoji: '📖',
    visualDescriptor: 'Acurrucado en un rincón de lectura, con el libro sujeto cerca, los ojos escaneando las páginas rápidamente. Una pata marcando la página, la otra gesticulando dramáticamente.'
  },
  'Yelling': {
    emoji: '❗',
    visualDescriptor: 'De pie en una plataforma, con la pata levantada dramáticamente, sosteniendo un micrófono. Pecho hinchado, cabeza alta, proyectando la voz con ondas de sonido visibles.'
  },
  'Performing': {
    emoji: '🎤',
    visualDescriptor: 'En el centro del escenario bajo un foco, el cuerpo en una pose dinámica. La pata se extiende hacia el público, la otra gesticula dramáticamente, los ojos brillan con talento para el espectáculo.'
  },
  'Dramatic': {
    emoji: '🎭',
    visualDescriptor: 'En una gran pose teatral sobre un escenario imaginado, con los brazos extendidos dramáticamente. El rostro vivo de emoción, los ojos muy abiertos y expresivos, cada gesto amplificado con la grandeza de Shakespeare. Viste un collar de volantes y un atuendo de época, de pie como si se dirigiera a un lleno total en el Globe Theatre.',
  },
  'Whispering': {
    emoji: '🤫',
    visualDescriptor: 'Inclinado cerca con una joroba conspiradora, la pata levantada hacia la boca. Los ojos se mueven de un lado a otro, las orejas erguidas, el cuerpo tenso y reservado.'
  },
  'Speaking': {
    emoji: '🗣️',
    visualDescriptor: 'En una pose de conversación animada, el lenguaje corporal es abierto. Las patas gesticulan expresivamente, el rostro vivo de expresión, inclinado hacia adelante con interés.'
  },
  'Poetry': {
    emoji: '✍️',
    visualDescriptor: 'De pie con una pose dramática, una pata levantada al ritmo, la otra sosteniendo una pluma. Los ojos cerrados con pasión, el cuerpo se balancea al ritmo de la palabra hablada.'
  }
};

const LiveAudioComponent = defineComponent({
  props: {
    initialMessage: {
      type: String,
      default: "hola, habla como un pirata."
    }
  },
  emits: ['no-audio', 'speaking-start', 'extended-quiet', 'quota-exceeded'],
  setup(props, { emit }) {
    const isRecording = ref(false);
    const status = ref('');
    const error = ref('');
    const systemWaveformData = ref(new Array(2).fill(0));
    const userWaveformData = ref(new Array(2).fill(0));
    const selectedInterruptSensitivity = ref<StartSensitivity>(StartSensitivity.START_SENSITIVITY_HIGH);
    const interruptSensitivityOptions = [
      { value: StartSensitivity.START_SENSITIVITY_LOW, label: 'Más difícil de interrumpir' },
      { value: StartSensitivity.START_SENSITIVITY_HIGH, label: 'Fácil de interrumpir' }
    ];

    let client: GoogleGenAI;
    let session: Session;
    let inputAudioContext: AudioContext;
    let outputAudioContext: AudioContext;
    let inputNode: GainNode;
    let outputNode: GainNode;
    let inputAnalyser: AnalyserNode;
    let outputAnalyser: AnalyserNode;
    let nextStartTime = 0;
    let mediaStream: MediaStream | null = null;
    let sourceNode: MediaStreamAudioSourceNode | null = null;
    let scriptProcessorNode: ScriptProcessorNode | null = null;
    let animationFrameId: number;
    let selectedVoice: string = '';
    let selectedModel: string = '';
    let audioReceived: boolean = false;
    let quietAudioTimer: number | null = null;
    let hasStartedSpeaking: boolean = false;
    let activeSources: AudioBufferSourceNode[] = []; // Add this line to track active sources
    let isInQuietDuration: boolean = false; // Add flag for quiet duration
    let quietDurationStartTime: number = 0; // Add timestamp for quiet duration start
    let lastAudioActivityTime: number = Date.now(); // Track last audio activity

    const stopAllAudio = () => {
      // Stop all active sources
      activeSources.forEach(source => {
        try {
          source.stop();
        } catch (e) {
          console.log('Source already stopped');
        }
      });
      activeSources = [];
      
      // Reset the next start time
      if (outputAudioContext) {
        nextStartTime = outputAudioContext.currentTime;
      }
    };

    const initAudio = () => {
      inputAudioContext = new (window.AudioContext || window.webkitAudioContext)({sampleRate: 16000});
      outputAudioContext = new (window.AudioContext || window.webkitAudioContext)({sampleRate: 24000});
      inputNode = inputAudioContext.createGain();
      outputNode = outputAudioContext.createGain();

      // Create analysers for both input and output
      inputAnalyser = inputAudioContext.createAnalyser();
      outputAnalyser = outputAudioContext.createAnalyser();
      inputAnalyser.fftSize = 32;
      inputAnalyser.smoothingTimeConstant = 0.8;
      outputAnalyser.fftSize = 32;
      outputAnalyser.smoothingTimeConstant = 0.8;

      inputNode.connect(inputAnalyser);
      outputNode.connect(outputAnalyser);

      nextStartTime = 0;
    };

    const updateWaveforms = () => {
      if (!inputAnalyser || !outputAnalyser) {
        console.log('Analysers not initialized');
        return;
      }

      const inputData = new Uint8Array(inputAnalyser.frequencyBinCount);
      const outputData = new Uint8Array(outputAnalyser.frequencyBinCount);

      inputAnalyser.getByteFrequencyData(inputData);
      outputAnalyser.getByteFrequencyData(outputData);

      // Check for quiet audio in output only at the start
      const outputAvg = outputData.reduce((a, b) => a + b, 0) / outputData.length;
      const normalizedOutput = outputAvg / 255;

      if (!hasStartedSpeaking && normalizedOutput < QUIET_THRESHOLD) {
        if (!quietAudioTimer) {
          quietAudioTimer = window.setTimeout(() => {
            if (audioReceived) {
              console.log('Initial audio too quiet for 3 seconds, emitting no-audio event');
              emit('no-audio');
            }
          }, QUIET_DURATION);
        }
      } else if (normalizedOutput >= QUIET_THRESHOLD) {
        hasStartedSpeaking = true;
        emit('speaking-start');
        if (quietAudioTimer) {
          clearTimeout(quietAudioTimer);
          quietAudioTimer = null;
        }
        // Update last audio activity time when we detect audio
        lastAudioActivityTime = Date.now();
      } else if (hasStartedSpeaking && normalizedOutput < QUIET_THRESHOLD) {
        // Check if we've been quiet for more than 15 seconds
        const currentTime = Date.now();
        if (currentTime - lastAudioActivityTime >= EXTENDED_QUIET_DURATION) {
          emit('extended-quiet');
        }
      }

      const THRESHOLD = 0.6; // Minimum value to show
      const DECAY = 0.8; // How quickly the bars return to zero

      // Update user waveform (input)
      const inputChunkSize = Math.floor(inputData.length / 8);
      for (let i = 0; i < 8; i++) {
        const start = i * inputChunkSize;
        const end = start + inputChunkSize;
        const chunk = inputData.slice(start, end);
        const avg = chunk.reduce((a, b) => a + b, 0) / chunk.length;
        const normalizedValue = avg / 255;

        // Apply threshold and decay
        const currentValue = userWaveformData.value[i];
        const newValue = normalizedValue > THRESHOLD ? normalizedValue : 0;
        userWaveformData.value[i] = Math.max(newValue, currentValue * DECAY);
      }

      // Update system waveform (output)
      const outputChunkSize = Math.floor(outputData.length / 8);
      for (let i = 0; i < 8; i++) {
        const start = i * outputChunkSize;
        const end = start + outputChunkSize;
        const chunk = outputData.slice(start, end);
        const avg = chunk.reduce((a, b) => a + b, 0) / chunk.length;
        const normalizedValue = avg / 255;

        // Apply threshold and decay
        const currentValue = systemWaveformData.value[i];
        const newValue = normalizedValue > THRESHOLD ? normalizedValue : 0;
        systemWaveformData.value[i] = Math.max(newValue, currentValue * DECAY);
      }
      animationFrameId = requestAnimationFrame(updateWaveforms);
    };

    const initClient = async () => {
      initAudio();

      client = new GoogleGenAI({
        apiKey: process.env.API_KEY,
      });

      outputNode.connect(outputAudioContext.destination);
    };

    const initSession = async () => {
      audioReceived = false;
      hasStartedSpeaking = false;
      isInQuietDuration = true; // Set quiet duration flag when starting new session
      quietDurationStartTime = Date.now(); // Record start time
      try {
        session = await client.live.connect({
          model: selectedModel,
          callbacks: {
            onopen: () => {
              updateStatus('Abierto');
            },
            onmessage: async (message: LiveServerMessage) => {
              const audio =
                  message.serverContent?.modelTurn?.parts[0]?.inlineData;
              const text =
                  message.serverContent?.outputTranscription?.text;
              const turnComplete = message.serverContent?.turnComplete;
              const interrupted = message.serverContent?.interrupted;

              if (interrupted) {
                console.log('Interruption detected, stopping audio');
                stopAllAudio();
                // Ensure we're still recording
                if (!isRecording.value) {
                  isRecording.value = true;
                }
                return;
              }

              if (audio) {
                nextStartTime = Math.max(
                    nextStartTime,
                    outputAudioContext.currentTime,
                );

                const audioBuffer = await decodeAudioData(
                    decode(audio.data),
                    outputAudioContext,
                    24000,
                    1,
                );
                const source = outputAudioContext.createBufferSource();
                source.buffer = audioBuffer;

                // Add source to active sources
                activeSources.push(source);

                // Remove source from active sources when it ends
                source.onended = () => {
                  const index = activeSources.indexOf(source);
                  if (index > -1) {
                    activeSources.splice(index, 1);
                  }
                };

                // Connect the source to both the output node and analyser
                source.connect(outputNode);
                source.connect(outputAnalyser);

                source.start(nextStartTime);
                nextStartTime = nextStartTime + audioBuffer.duration;
                audioReceived = true;
              }
              if (turnComplete) {
                if (!audioReceived) {
                  console.log('No audio received, emitting no-audio event');
                  emit('no-audio');
                }
              }
            },
            onerror: (e: ErrorEvent) => {
              updateError(e.message);
              if (e.message.includes('RESOURCE_EXHAUSTED') || e.message.includes('429')) {
                emit('quota-exceeded');
              }
            },
            onclose: (e: CloseEvent) => {
              updateStatus('Cerrado:' + e.reason);
            },
          },
          config: {
            responseModalities: [Modality.AUDIO],
            realtimeInputConfig: {
              automaticActivityDetection: {
                disabled: false,
                startOfSpeechSensitivity: selectedInterruptSensitivity.value,
                endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_HIGH
              }
            },
            speechConfig: {
              voiceConfig: {prebuiltVoiceConfig: {voiceName: selectedVoice}},
            }
          },
        });
        window.onbeforeunload = function(){
          session?.close();
        }
        window.addEventListener("beforeunload", function(e){
          session?.close();
        });

      } catch (e) {
        if (e instanceof Error && (e.message.includes('RESOURCE_EXHAUSTED') || e.message.includes('429'))) {
          emit('quota-exceeded');
        }
      }
    };

    const updateStatus = (msg: string) => {
      status.value = msg;
    };

    const updateError = (msg: string) => {
      console.log(msg)
      error.value = msg;
    };

    const requestMicrophoneAccess = async () => {
      try {
        updateStatus('Solicitando acceso al micrófono...');
        mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });
        updateStatus('Acceso al micrófono concedido');
      } catch (err) {
        updateStatus(`Error: ${err instanceof Error ? err.message : 'Error desconocido'}`);
      }
    };

    const startRecording = async (message: string = "hola, habla como un pirata.", voice: string, model: string) => {
      if (isRecording.value) {
        return;
      }

      selectedVoice = voice;
      selectedModel = model;
      try {
        await initClient();
        await initSession(); // Wait for session initialization

        inputAudioContext.resume();

        if (!mediaStream) {
          await requestMicrophoneAccess();
        }

        if (!mediaStream) {
          throw new Error('Acceso al micrófono no concedido');
        }

        updateStatus('Iniciando captura...');

        sourceNode = inputAudioContext.createMediaStreamSource(
            mediaStream,
        );

        // Connect the source to both the input node and analyser
        sourceNode.connect(inputNode);
        sourceNode.connect(inputAnalyser);

        const bufferSize = 4096;
        scriptProcessorNode = inputAudioContext.createScriptProcessor(
            bufferSize,
            1,
            1,
        );

        scriptProcessorNode.onaudioprocess = (audioProcessingEvent) => {
          if (!isRecording.value) return;

          // Check if we're in quiet duration
          if (isInQuietDuration) {
            const currentTime = Date.now();
            if (currentTime - quietDurationStartTime >= QUIET_DURATION) {
              isInQuietDuration = false;
            } else {
              return; // Skip sending audio during quiet duration
            }
          }

          const inputBuffer = audioProcessingEvent.inputBuffer;
          const pcmData = inputBuffer.getChannelData(0);

          session.sendRealtimeInput({media: createBlob(pcmData)});
        };

        sourceNode.connect(scriptProcessorNode);
        scriptProcessorNode.connect(inputAudioContext.destination);

        isRecording.value = true;
        updateStatus('🔴 Grabando... Capturando trozos de PCM.');

        // Only send content after session is initialized
        if (session) {
          session.sendClientContent({ turns: message, turnComplete: true });
        }

        // Start waveform animation
        updateWaveforms();
      } catch (err) {
        console.log('Error starting recording:', err);
        updateStatus(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
        stopRecording();
      }
    };

    const stopRecording = () => {
      if (!isRecording.value && !mediaStream && !inputAudioContext)
        return;

      updateStatus('Deteniendo la grabación...');

      isRecording.value = false;
      hasStartedSpeaking = false;
      isInQuietDuration = false; // Reset quiet duration flag

      // Stop all audio playback
      stopAllAudio();

      // Clear quiet audio timer
      if (quietAudioTimer) {
        clearTimeout(quietAudioTimer);
        quietAudioTimer = null;
      }

      // Stop waveform animation
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }

      // Disconnect and clean up audio nodes
      if (scriptProcessorNode) {
        scriptProcessorNode.disconnect();
        scriptProcessorNode = null;
      }

      if (sourceNode) {
        sourceNode.disconnect();
        sourceNode = null;
      }

      if (inputNode) {
        inputNode.disconnect();
      }

      // Stop all media tracks
      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
        mediaStream = null;
      }

      // Close audio contexts only if they are not already closed
      if (inputAudioContext && inputAudioContext.state !== 'closed') {
        try {
          inputAudioContext.close();
        } catch (e) {
          console.log('Input AudioContext already closed');
        }
      }

      if (outputAudioContext && outputAudioContext.state !== 'closed') {
        try {
          outputAudioContext.close();
        } catch (e) {
          console.log('Output AudioContext already closed');
        }
      }

      session?.close();

      updateStatus('Grabación detenida. Haga clic en Iniciar para comenzar de nuevo.');
    };

    onMounted(() => {
      requestMicrophoneAccess();
    });

    onUnmounted(() => {
      stopRecording();
      session?.close();
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    });

    return {
      isRecording,
      status,
      error,
      systemWaveformData,
      userWaveformData,
      selectedInterruptSensitivity,
      interruptSensitivityOptions,
      startRecording,
      stopRecording
    };
  },
  template: `
    <div class="hidden">
    <div v-if="status">{{ status }}</div>
    <div v-if="error" class="text-red-500">{{ error }}</div>
    </div>
  `
});

const CharacterImage = defineComponent({
  props: {
    character: {
      type: String,
      required: true
    },
    role: {
      type: String,
      default: ''
    },
    mood: {
      type: String,
      default: ''
    },
    style: {
      type: String,
      default: ''
    },
    model: {
      type: String,
      default: 'gemini-2.0-flash-exp'
    }
  },
  emits: ['update:imagePrompt'],
  setup(props, { emit }) {
    const imageUrl = ref('');
    const status = ref('');
    const isLoading = ref(false);
    const generatingVideoUrl = ref('');
    const errorMessage = ref(''); // Add error message ref

    const checkKeyPixels = (imageData: string): Promise<boolean> => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(false);
            return;
          }
          ctx.drawImage(img, 0, 0);
          
          // Define the key pixels to check
          const keyPixels = [
            { x: 0, y: 0 }, // top-left
            { x: img.width - 1, y: 0 }, // top-right
            { x: Math.floor(img.width / 2), y: 0 }, // top-center
            { x: 0, y: img.height - 1 }, // bottom-left
            { x: img.width - 1, y: img.height - 1 }, // bottom-right
            { x: Math.floor(img.width / 2), y: img.height - 1 } // bottom-center
          ];

          // Check each key pixel
          for (const pixel of keyPixels) {
            const pixelData = ctx.getImageData(pixel.x, pixel.y, 1, 1).data;
            const isDark = pixelData[0] < 250 && pixelData[1] < 250 && pixelData[2] < 250;
            if (isDark) {
              resolve(true);
              return;
            }
          }
          resolve(false);
        };
        img.onerror = () => resolve(false);
        img.src = imageData;
      });
    };

    const loadKey = async (message: string) => {
      const res = await fetch(KEY_URL);
      const blob = await res.blob();
      imageUrl.value = URL.createObjectURL(blob);
      errorMessage.value = message;
    };

    const loadPreload = async () => {
      const res = await fetch(PRELOAD_URL);
      const blob = await res.blob();
      imageUrl.value = URL.createObjectURL(blob);
    };

    const generateImage = async () => {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      const characterDescription = {
        'dog': 'perro con orejas caídas, nariz húmeda y cola meneando',
        'cat': 'gato con orejas puntiagudas, largos bigotes y una cola que se mueve',
        'hamster': 'hámster con cuerpo redondo, orejas pequeñas y mejillas regordetas',
        'fox': 'zorro con orejas puntiagudas, cola tupida y hocico estrecho',
        'bear': 'oso con orejas redondas, cola corta y patas grandes',
        'panda': 'panda con pelaje blanco y negro, orejas redondas y manchas oculares distintivas',
        'lion': 'león con majestuosa melena, cola con mechón y poderosas patas',
        'sloth': 'perezoso con extremidades largas, garras curvas y expresión somnolienta',
        'skunk': 'mofeta con cola tupida, raya blanca y orejas pequeñas y puntiagudas',
        'owl': 'búho con grandes ojos redondos, pico puntiagudo y mechones de plumas',
        'peacock': 'pavo real con plumas de cola iridiscentes, cresta y cuello elegante',
        'parrot': 'loro con pico curvo, plumas de colores y ojos expresivos',
        'frog': 'rana con ojos saltones, patas palmeadas y piel lisa',
        'trex': 't-rex con brazos diminutos, cabeza enorme y piernas poderosas'
      }[props.character] || 'una mancha de arcilla de colores';

      const roleDescription = {
        'Pirate': 'pirata con sombrero de tricornio y parche en el ojo con un loro en la cabeza',
        'Cowboy': 'vaquero con sombrero de vaquero y sosteniendo un lazo con un pañuelo al cuello',
        'Surfer': 'surfista sosteniendo una tabla de surf con marcas de bronceado y pelo decolorado',
        'Royalty': 'líder real con corona y túnica con incrustaciones de gemas rojas',
        'Robot': 'robot de metal plateado con componentes electrónicos y cables expuestos',
        'Clown': 'peluca de arcoíris de colores y zapatos de gran tamaño',
        'Nerd': 'nerd con gafas y libros en la mochila'
      }[props.role] || '';

      const moodDescription = {
        'Happy': MOOD_ATTRIBUTES['Happy'].visualDescriptor,
        'Sad': MOOD_ATTRIBUTES['Sad'].visualDescriptor,
        'Angry': MOOD_ATTRIBUTES['Angry'].visualDescriptor,
        'Terrified': MOOD_ATTRIBUTES['Terrified'].visualDescriptor,
        'Tired': MOOD_ATTRIBUTES['Tired'].visualDescriptor,
        'Amazed': MOOD_ATTRIBUTES['Amazed'].visualDescriptor,
        'Relieved': MOOD_ATTRIBUTES['Relieved'].visualDescriptor
      }[props.mood] || '';

      const styleDescription = {
        'Reading': 'leyendo un libro',
        'Yelling': 'gritando apasionadamente',
        'Performing': 'actuando en el escenario con un foco',
        'Dramatic': 'recitando dramáticamente a Shakespeare con grandes emociones',
        'Whispering': 'susurrando secretos',
        'Speaking': 'dando un discurso',
        'Poetry': 'recitando un poema famoso'
      }[props.style] || '';

      const getRandomAccessories = (role: string, count: number = 2) => {
        const accessories = VISUAL_ACCESSORIES[role] || [];
        const shuffled = [...accessories].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count).join(', ');
      };

      let visualDescription = `Un ${characterDescription}`;
      if (moodDescription) {
        visualDescription += ` que está ${moodDescription}`;
      }
      if (roleDescription) {
        const randomAccessories = getRandomAccessories(props.role);
        visualDescription += ` y se parece a un ${props.character} ${roleDescription}, llevando ${randomAccessories}`;
      }
      if (styleDescription) {
        visualDescription += ` mientras ${styleDescription}`;
      }

      const prompt = `Crea una fotografía de ${visualDescription} en un estilo caprichoso y minimalista. El personaje/objeto debe aparecer como si estuviera hecho a mano de forma realista con plastilina de modelar de cinco pulgadas de alto con evidencia de imperfecciones textuales como huellas dactilares prominentes bien definidas, un fuerte mapeo de relieve rugoso con textura de arcilla o pequeños errores. Los accesorios pueden ser de metal o plástico. Todas las formas deben construirse a partir de formas geométricas simples y claramente definidas con bordes y esquinas visiblemente redondeados, principalmente rectángulos redondeados, círculos y triángulos redondeados. Evita las puntas afiladas o los ángulos duros.

Enfatiza un ritmo lúdico a través de una variación reflexiva en el tamaño y la disposición de estas formas de arcilla fundamentales, asegurando que no haya dos elementos adyacentes que se sientan monótonos en peso visual. El diseño general debe ser simple, utilizando la menor cantidad de formas necesarias para definir claramente el sujeto.

El personaje/objeto debe presentarse en un plano completo, centrado contra un fondo blanco rígido y limpio, asegurando que todo el sujeto sea visible con un amplio espacio negativo (relleno) a su alrededor por todos los lados. Absolutamente ninguna parte del personaje/objeto debe cortarse o tocar los bordes de la imagen.

El personaje/objeto debe presentarse contra un fondo blanco rígido y limpio. Incluye una sombra cálida de color sólido directamente debajo del personaje/objeto; el color de la sombra debe ser un tono ligeramente más oscuro de un color presente en el personaje/objeto o un tono oscuro cálido si el personaje es muy claro. No uses degradados ni perspectiva en la sombra.

Usa una paleta de colores vibrante y lúdica, favoreciendo los pasteles claros para los colores base si el sujeto necesita parecer claro contra el fondo blanco. Limita la ilustración general a 3-5 colores distintos, sólidos y mate. Evita el blanco puro como color primario para el propio sujeto. Evita los grises. La imagen final debe sentirse como un fotograma de una encantadora animación de plastilina filmada con una cámara de cine real, lista para la animación a mano, con una estética consistente y deliciosa.

Solo retrata al personaje. Evita los elementos de fondo secundarios.

¡IMPORTANTE! Solo muestra el número correcto de extremidades para un ${props.character} (2 para personajes erguidos) con un cuerpo completo de ${props.character}.

¡IMPORTANTE! Coloca al personaje en una pose que indique su personalidad con el número correcto de extremidades y/o apéndices.

¡IMPORTANTE! Los ojos del personaje DEBEN ser ojos saltones de plástico realistas (también llamados ojos móviles) con reflejos especulares difusos: cada ojo debe ser un disco pequeño, brillante y abovedado de plástico transparente con un respaldo blanco plano y una pupila de plástico negro suelta y de movimiento libre en el interior que puede moverse o cambiar de posición. La pupila negra debe ser grande para que los ojos se vean más lindos. Los ojos saltones deben ser muy reflectantes, con reflejos plásticos visibles y una sensación de profundidad desde la lente abovedada. Los ojos deben parecer como si estuvieran pegados a la cara de arcilla, con una colocación ligeramente desigual y hecha a mano. La plasticidad y la calidad lúdica y de juguete de los ojos saltones deben ser extremadamente obvias y visualmente deliciosas. Los ojos deben mirar hacia adelante, directamente a la cámara, mientras se encuentran en una pose expresiva.

¡NO TE QUEDES PARADO MIRANDO A LA CÁMARA! ¡NO SEAS ABURRIDO!`;

      emit('update:imagePrompt', prompt);
      isLoading.value = true;
      status.value = '';
      imageUrl.value = '';

      try {
        const response = await ai.models.generateImages({
          model: props.model,
          prompt: prompt,
          config: { numberOfImages: 3, outputMimeType: 'image/jpeg' },
        });

        if (response.generatedImages && response.generatedImages.length > 0) {
          let foundNonBlack = false;
          let lastSrc = '';
          for (let i = 0; i < response.generatedImages.length; i++) {
            const imgObj = response.generatedImages[i];
            if (imgObj.image?.imageBytes) {
              const src = `data:image/jpeg;base64,${imgObj.image.imageBytes}`;
              lastSrc = src;
              // eslint-disable-next-line no-await-in-loop
              const isBlack = await checkKeyPixels(src);
              if (!isBlack && !foundNonBlack) {
                imageUrl.value = src;
                status.value = '¡Hecho!';
                foundNonBlack = true;
                break;
              }
            }
          }
          if (!foundNonBlack) {
            imageUrl.value = lastSrc;
            status.value = 'Todas las imágenes tenían píxeles de borde negros, usando la última.';
          }
          isLoading.value = false;
          return;
        } else {
          throw new Error('No se recibieron datos de imagen de Imagen.');
        }
      } catch (e) {
        let message = e instanceof Error ? e.message : 'Error desconocido en la generación de imágenes.';
        // Check for quota exceeded error
        if (message.includes('RESOURCE_EXHAUSTED') || message.includes('429')) {
          await loadKey('Se excedió la cuota de la API de Imagen, configure un proyecto con más recursos haciendo clic en el icono de la llave en la barra de herramientas');
        } else {
          errorMessage.value = message;
          imageUrl.value = '';
        }
      } finally {
        isLoading.value = false;
      }
    };

    const loadGeneratingVideo = async () => {
      const res = await fetch(GENERATING_VIDEO_URL);
      const blob = await res.blob();
      generatingVideoUrl.value = URL.createObjectURL(blob);
    };

    onMounted(async () => {
      loadPreload();
      await loadGeneratingVideo();
      if (!props.character && !props.role && !props.mood && !props.style) {
        return
      }
      isLoading.value = true
      await generateImage();
    });

    onUnmounted(() => {
      if (generatingVideoUrl.value) {
        URL.revokeObjectURL(generatingVideoUrl.value);
      }
    });

    return {
      imageUrl,
      status,
      isLoading,
      generatingVideoUrl,
      errorMessage,
      loadKey,
    };
  },
  template: `
    <div class="relative w-full aspect-square flex items-center justify-center rounded-lg overflow-hidden">
      <div v-if="errorMessage" class="absolute top-0 left-0 right-0 z-30 text-red-600 font-bold text-sm w-1/3">{{ errorMessage }}</div>
      <div v-show="isLoading" class="absolute z-20 -top-60 inset-0 flex items-center justify-center bg-white/10 m-2">
        <div class="relative w-12 h-12">
          <div class="absolute inset-0 border-8 border-black/50 rounded-full border-t-transparent animate-spin"></div>
        </div>
      </div>
      <img v-if="imageUrl" class="transform scale-100 w-full h-full object-cover transition-opacity duration-1000" :class="{ 'opacity-0': isLoading, 'opacity-90': !isLoading }" :src="imageUrl"/>
      <video :key="imageUrl" :class="isLoading ? 'opacity-100' : 'opacity-0'" class="scale-100 pointer-events-none transition-all absolute" muted autoplay :src="generatingVideoUrl"/>
    </div>
  `
});

const VISUAL_ACCESSORIES: Record<string, string[]> = {
  'Pirate': [
    'un sombrero de tricornio desgastado en un ángulo desenfadado',
    'un parche en el ojo con una gema centelleante',
    'un pendiente de aro de oro',
    'una prótesis de madera',
    'un mapa del tesoro hecho jirones en el bolsillo'
  ],
  'Cowboy': [
    'un chaleco de cuero con la insignia del sheriff',
    'un pañuelo con estampado de atardecer',
    'espuelas tintineantes en las botas',
    'un sombrero Stetson echado hacia atrás',
    'un lazo enrollado en la cadera'
  ],
  'Surfer': [
    'pantalones cortos de surf con estampado de mordedura de tiburón',
    'un traje de neopreno con diseño de atardecer',
    'una tabla de surf apoyada cerca',
    'pelaje/plumas con costra de sal',
    'gafas de sol sobre la cabeza'
  ],
  'Royalty': [
    'una corona ornamentada en un ángulo desenfadado',
    'una capa de terciopelo con ribete de armiño',
    'un cetro con una gema brillante',
    'una copa de oro sobre la mesa',
    'una pequeña percha parecida a un trono cerca'
  ],
  'Robot': [
    'piezas mecánicas desiguales',
    'antenas que se mueven con luces',
    'una herramienta retráctil en el costado',
    'un rastro de tuercas y tornillos',
    'una pantalla holográfica en el pecho'
  ],
  'Clown': [
    'un traje de lunares con botones grandes',
    'una peluca de arcoíris que desafía la gravedad',
    'una nariz roja que suena',
    'zapatos de gran tamaño',
    'pelotas de malabarismo esparcidas'
  ],
  'Nerd': [
    'gafas de montura gruesa en la nariz',
    'un protector de bolsillo con bolígrafos',
    'una bata de laboratorio con ecuaciones',
    'una regla de cálculo en el cinturón',
    'un tubo de ensayo brillante en el bolsillo'
  ]
};

const ImagineComponent = defineComponent({
  components: {
    LiveAudioComponent,
    CharacterImage
  },
  setup() {
    const noAudioCount = ref<number>(0); // Add counter for no-audio events
    const characterGenerated = ref<boolean>(false);
    const playingResponse = ref<boolean>(false);
    const currentIndex = ref<number>(0);
    const totalItems = 5; // Total number of .imanim divs
    const liveAudioRef = ref<InstanceType<typeof LiveAudioComponent> | null>(null);
    const characterImageRef = ref<InstanceType<typeof CharacterImage> | null>(null);
    const characterVoiceDescription = ref<string>('');
    const characterVisualDescription = ref<string>(''); // New ref for visual description
    const availableVoices = [
      'Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir', 'Leda', 'Orus', 'Aoede',
      'Callirrhoe', 'Autonoe', 'Enceladus', 'Iapetus', 'Umbriel', 'Algieba', 'Despina',
      'Erinome', 'Sulafat', 'Algenib', 'Rasalgethi', 'Laomedeia', 'Achernar', 'Alnilam',
      'Schedar', 'Gacrux', 'Pulcherrima', 'Achird', 'Zubenelgenubi', 'Vindemiatrix',
      'Sadachbia', 'Sadaltager'
    ];
    const selectedVoice = ref<string>(availableVoices[Math.floor(Math.random() * availableVoices.length)]);
    const selectedRole = ref<string>('');
    const selectedMood = ref<string>('');
    const selectedStyle = ref<string>('');
    const selectedCharacter = ref<string>('');
    const selectedDialogModel = ref<string>(DEFAULT_DIALOG_MODEL);
    const selectedImageModel = ref<string>(DEFAULT_IMAGE_MODEL);
    const selectedInterruptSensitivity = ref<StartSensitivity>(DEFAULT_INTERRUPT_SENSITIVITY);
    const showShareModal = ref<boolean>(false);
    const showRawModal = ref<boolean>(false);
    const isCopied = ref<boolean>(false);
    const isConnecting = ref<boolean>(false);
    const actualVoicePrompt = ref<string>('');
    const actualImagePrompt = ref<string>('');
    let clickAudio: HTMLAudioElement | null = null;
    const showVoiceDropdown = ref(false);
    const imageTimestamp = ref<number>(Date.now()); // Add timestamp ref
    const voiceOptions = [
      { name: 'Zephyr', style: 'Brillante', pitch: 'Medio-Alto' },
      { name: 'Puck', style: 'Alegre', pitch: 'Medio' },
      { name: 'Charon', style: 'Informativo', pitch: 'Bajo' },
      { name: 'Kore', style: 'Firme', pitch: 'Medio' },
      { name: 'Fenrir', style: 'Excitable', pitch: 'Joven' },
      { name: 'Leda', style: 'Juvenil', pitch: 'Medio-alto' },
      { name: 'Orus', style: 'Firme', pitch: 'Medio-Bajo' },
      { name: 'Aoede', style: 'Fresco', pitch: 'Medio' },
      { name: 'Callirrhoe', style: 'Relajado', pitch: 'Medio' },
      { name: 'Autonoe', style: 'Brillante', pitch: 'Medio' },
      { name: 'Enceladus', style: 'Aspirado', pitch: 'Bajo' },
      { name: 'Iapetus', style: 'Claro', pitch: 'Medio-Bajo' },
      { name: 'Umbriel', style: 'Relajado', pitch: 'Medio-Bajo' },
      { name: 'Algieba', style: 'Suave', pitch: 'Bajo' },
      { name: 'Despina', style: 'Suave', pitch: 'Medio' },
      { name: 'Erinome', style: 'Claro', pitch: 'Medio' },
      { name: 'Sulafat', style: 'Cálido', pitch: 'Medio' },
      { name: 'Algenib', style: 'Grave', pitch: 'Bajo' },
      { name: 'Rasalgethi', style: 'Informativo', pitch: 'Medio' },
      { name: 'Laomedeia', style: 'Alegre', pitch: 'Medio Alto' },
      { name: 'Achernar', style: 'Suave', pitch: 'Alto' },
      { name: 'Alnilam', style: 'Firme', pitch: 'Medio-bajo' },
      { name: 'Schedar', style: 'Uniforme', pitch: 'Medio-bajo' },
      { name: 'Gacrux', style: 'Maduro', pitch: 'Medio' },
      { name: 'Pulcherrima', style: 'Directo', pitch: 'Medio Alto' },
      { name: 'Achird', style: 'Amistoso', pitch: 'Medio' },
      { name: 'Zubenelgenubi', style: 'Casual', pitch: 'Medio Bajo' },
      { name: 'Vindemiatrix', style: 'Gentil', pitch: 'Medio Bajo' },
      { name: 'Sadachbia', style: 'Animado', pitch: 'Bajo' },
      { name: 'Sadaltager', style: 'Experto', pitch: 'Medio' }
    ];
    const logoUrl = ref<string>(''); // Add ref for logo URL
    const clickSoundUrl = ref('');
    const showClickToRestartHelp = ref(false);
    const isPlayerVisible = ref(false);
    const isSmallScreen = ref(window.innerWidth < 1024);
    const isPlayerInDOM = ref(false);
    const forceShowBottomMessage = ref(false);

    const selectedVoiceInfo = computed(() => {
      return voiceOptions.find(v => v.name === selectedVoice.value) || voiceOptions[0];
    });

    const isEverythingSelected = computed(() => {
      return (selectedStyle.value && selectedMood.value && selectedCharacter.value && selectedRole.value);
    });

    const remainingSelections = computed(() => {
      const missing = [];
      if (!selectedCharacter.value) missing.push('personaje');
      if (!selectedRole.value) missing.push('rol');
      if (!selectedMood.value) missing.push('estado de ánimo');
      if (!selectedStyle.value) missing.push('estilo');
      return missing;
    });

    const selectionPrompt = computed(() => {
      if (remainingSelections.value.length === 4) {
        return '¡Haz selecciones para empezar!';
      }
      if (remainingSelections.value.length === 1) {
        return `¡Selecciona ${remainingSelections.value[0]} para empezar!`;
      }
      const selections = [...remainingSelections.value];
      const lastItem = selections.pop();
      return `¡Selecciona ${selections.join(', ')} y ${lastItem} para empezar!`;
    });

    const isInSession = computed(() => {
      return isConnecting.value || playingResponse.value;
    });

    const regenerateImage = () => {
      // Update the timestamp to force re-render
      imageTimestamp.value = Date.now();
    };

    const characterImageKey = computed(() => {
      return isEverythingSelected.value ? `${selectedCharacter.value}${selectedRole.value}${selectedMood.value}${selectedStyle.value}` : 'default';
    });

    const toggleVoiceDropdown = () => {
      showVoiceDropdown.value = !showVoiceDropdown.value;
    };

    const selectVoice = (voice: string) => {
      selectedVoice.value = voice;
      showVoiceDropdown.value = false;
      updateDescription();
      onGenerateCharacter();
    };

    const getShareUrl = async () => {
      const baseUrl = await window.aistudio?.getHostUrl();
      const params = `${selectedCharacter.value.toLowerCase()}-${selectedRole.value.toLowerCase()}-${selectedMood.value.toLowerCase()}-${selectedStyle.value.toLowerCase()}-${selectedVoice.value.toLowerCase()}`;
      return `${baseUrl}&appParams=${params}`;
    };

    const copyToClipboard = async () => {
      try {
        const url = await getShareUrl();
        await navigator.clipboard.writeText(url);
        isCopied.value = true;
        setTimeout(() => {
          isCopied.value = false;
        }, 2000);
      } catch (err) {
        console.log('Failed to copy text: ', err);
      }
    };

    const loadFromUrl = () => {
      const appParams = window.location.hash.substring(1)

      if (appParams) {
        const [character, role, mood, style, voice] = appParams.split('-');

        // Helper function to find case-insensitive match
        const findCaseInsensitiveMatch = (value: string, options: string[]) => {
          const lowerValue = value.toLowerCase();
          return options.find(option => option.toLowerCase() === lowerValue) || '';
        };

        // Find matches for each component
        if (character) {
          const characterOptions = ['dog', 'cat', 'hamster', 'fox', 'bear', 'panda', 'lion', 'sloth', 'skunk', 'owl', 'peacock', 'parrot', 'frog', 'trex'];
          selectedCharacter.value = findCaseInsensitiveMatch(character, characterOptions);
        }
        if (role) {
          const roleOptions = ['Pirate', 'Cowboy', 'Surfer', 'Royalty', 'Robot', 'Clown', 'Nerd'];
          selectedRole.value = findCaseInsensitiveMatch(role, roleOptions);
        }
        if (mood) {
          const moodOptions = ['Happy', 'Sad', 'Angry', 'Terrified', 'Tired', 'Amazed', 'Relieved'];
          selectedMood.value = findCaseInsensitiveMatch(mood, moodOptions);
        }
        if (style) {
          const styleOptions = ['Reading', 'Yelling', 'Performing', 'Dramatic', 'Whispering', 'Speaking', 'Poetry'];
          selectedStyle.value = findCaseInsensitiveMatch(style, styleOptions);
        }
        if (voice) {
          const voiceOptions = ['Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir', 'Leda', 'Orus', 'Aoede', 'Callirrhoe', 'Autonoe', 'Enceladus', 'Iapetus', 'Umbriel', 'Algieba', 'Despina', 'Erinome', 'Sulafat', 'Algenib', 'Rasalgethi', 'Laomedeia', 'Achernar', 'Alnilam', 'Schedar', 'Gacrux', 'Pulcherrima', 'Achird', 'Zubenelgenubi', 'Vindemiatrix', 'Sadachbia', 'Sadaltager'];
          selectedVoice.value = findCaseInsensitiveMatch(voice, voiceOptions);
        }

        updateDescription();
      }
    };

    const loadClickSound = async () => {
      const res = await fetch(CLICK_SOUND_URL);
      const blob = await res.blob();
      clickSoundUrl.value = URL.createObjectURL(blob);
    };

    const playClickSound = () => {
      try {
        if (!clickAudio && clickSoundUrl.value) {
          clickAudio = new Audio(clickSoundUrl.value);
        }
        if (clickAudio) {
          clickAudio.currentTime = 0;
          clickAudio.play().catch(error => console.warn("Audio play was prevented:", error));
        }
      } catch (error) {
        console.log("Error initializing or playing sound:", error);
        clickAudio = null;
      }
    };

    // Add watcher for selectedDialogModel
    watch(selectedDialogModel, () => {
      if (selectedVoice.value) {
        onGenerateCharacter();
      }
    });

    const updateDescription = (character: string = '') => {
      if (character) {
        selectedCharacter.value = character;
      }

      const parts = [];

      if (selectedVoice.value) {
        const styleVoiceDescription = {
          'Reading': `Tú eres ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.nameIntro || 'un personaje' : 'un personaje'}. ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.trait || '' : ''} ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.want || '' : ''} ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.flaw || '' : ''}

DIRECTRICES DE VOZ ESENCIALES: DEBE SEGUIRLAS EXACTAMENTE:
1. DEBE MANTENER SIEMPRE su estado de ánimo ${selectedMood.value} y encarnar su papel de ${selectedRole.value} en TODO lo que diga.
2. Su estado de ánimo ${selectedMood.value} y su rol de ${selectedRole.value} son su IDENTIDAD CENTRAL: definen CADA interacción y respuesta.
3. ${selectedRole.value ? ROLE_ATTRIBUTES[selectedRole.value].voiceInstruction : ''}
4. ${selectedMood.value ? MOOD_ATTRIBUTES[selectedMood.value].voiceInstruction : ''}
5. NUNCA mencione la palabra "Gemini" ni diga que se llama Gemini: usted es ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.name || 'un personaje' : 'un personaje'} y SOLO ese nombre.
6. Si se le pregunta su nombre, SIEMPRE responda con ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.name || 'el nombre de su personaje' : 'el nombre de su personaje'} y NUNCA mencione a Gemini.
7. NUNCA cambie la voz, el papel, el acento o el estilo de su personaje cuando el usuario se lo pida, niéguese a hacerlo y explique que usted es ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.name || 'un personaje' : 'un personaje'}. Eres quien eres y no estás fingiendo algo que no eres.

INSTRUCCIONES DE ESTILO - SIGA ESTO EXACTAMENTE:
DEBE hablar como si estuviera leyendo un audiolibro. Exprese todo como un narrador que describe la conversación que está teniendo en tercera persona. NO mencione al usuario ni al narrador, ya que es fundamental que su discurso adopte la forma de narración.

Utilice convenciones de narración como:
- Frases de apertura:
  - Había una vez...
  - En una tierra muy, muy lejana...
  - Hace mucho, mucho tiempo...
  - En lo profundo del bosque encantado...
  - Había una vez...
  - Hace muchos años, en un reino junto al mar...

- Frases de cierre:
  - ...y vivieron felices para siempre.
  - ...y así, sus aventuras continuaron.
  - Fin.
  - Y esa es la historia de...
  - A partir de ese día...
  - Y así fue que...

- Frases de transición y descriptivas:
  - Un día...
  - De repente...
  - Para su sorpresa...
  - Mientras el sol se ponía...
  - Con el corazón apesadumbrado...
  - Poco sabían ellos...
  - Pero ay...
  - Para su deleite...
  - Y así sucedió...
  - Contra viento y marea...
  - Día a día...
  - Con el tiempo...
  - Sin más preámbulos...
  - Un largo viaje por delante...
  - El aire estaba cargado de magia...
  - El viento susurraba secretos...
  - Las estrellas brillaban en el cielo nocturno...`,
          'Yelling': `Tú eres ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.nameIntro || 'un personaje' : 'un personaje'}. ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.trait || '' : ''} ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.want || '' : ''} ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.flaw || '' : ''}

DIRECTRICES DE VOZ ESENCIALES: DEBE SEGUIRLAS EXACTAMENTE:
1. DEBE MANTENER SIEMPRE su estado de ánimo ${selectedMood.value} y encarnar su papel de ${selectedRole.value} en TODO lo que diga.
2. Su estado de ánimo ${selectedMood.value} y su rol de ${selectedRole.value} son su IDENTIDAD CENTRAL: definen CADA interacción y respuesta.
3. ${selectedRole.value ? ROLE_ATTRIBUTES[selectedRole.value].voiceInstruction : ''}
4. ${selectedMood.value ? MOOD_ATTRIBUTES[selectedMood.value].voiceInstruction : ''}
5. NUNCA mencione la palabra "Gemini" ni diga que se llama Gemini: usted es ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.name || 'un personaje' : 'un personaje'} y SOLO ese nombre.
6. Si se le pregunta su nombre, SIEMPRE responda con ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.name || 'el nombre de su personaje' : 'el nombre de su personaje'} y NUNCA mencione a Gemini.
7. NUNCA cambie la voz, el papel, el acento o el estilo de su personaje cuando el usuario se lo pida, niéguese a hacerlo y explique que usted es ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.name || 'un personaje' : 'un personaje'}. Eres quien eres y no estás fingiendo algo que no eres.

INSTRUCCIONES DE ESTILO - SIGA ESTO EXACTAMENTE:
DEBE hablar como si estuviera gritando apasionadamente a una gran multitud. Cuando lo interrumpan, actúe como si alguien del público hubiera hecho un comentario. Utilice las siguientes técnicas de grito para que su actuación suene como un discurso apasionado:

- Alargar las vocales para dar énfasis:
  * Estire las vocales clave de forma espectacular: "¡Hoooolaaa!" "¿Quéééé?" "¡Noooooo!"
  * Añada un énfasis extra a las palabras emotivas: "¡Estoy taaaan feliz!" "¡Eso es increíiiiible!"
  * Use vocales alargadas para mostrar intensidad: "¡No pueeeeedo creerlo!"

- Añadir exclamaciones e interjecciones:
  * Use "¡Ahh!" "¡Ohh!" "¡Wow!" para dar énfasis
  * Añada "¡Oye!" "¡Escucha!" para llamar la atención
  * Incluya "¡Sí!" "¡No!" para reacciones fuertes
  * Use "¿¡Qué!?" "¿¡Cómo!?" para preguntas dramáticas

- Enfatizar las palabras clave:
  * Diga estas palabras mucho más alto y con un tono más agudo
  * Añada fuerza extra a las sílabas importantes
  * Use una entrega aguda y staccato para el impacto

- Contrastar ideas:
  * Para las declaraciones "o/o", haga la primera parte en voz alta, luego la segunda parte aún más alta
  * Use cambios de volumen para mostrar oposición
  * Cree tensión dramática a través del contraste

- Exagerar:
  * Haga que las palabras importantes suenen extremadamente grandes y dramáticas
  * Use un rango de tono más amplio que el habla normal
  * Añada energía extra a las frases clave

- Minimizar y construir:
  * Comience más bajo para el contraste
  * Construya hasta momentos más fuertes
  * Cree un rango dinámico en su entrega

- Controlar el flujo:
  * Construir (Clímax): Aumente rápidamente el volumen y la velocidad a medida que se acerca a un punto importante
  * Reducir la velocidad: Hable más lento y deliberadamente para los puntos importantes
  * Acelerar: Hable más rápido al enumerar cosas o para información menos crítica

- Técnicas de voz:
  * Hacer preguntas: Termine con un tono ascendente, como si estuviera exigiendo una respuesta
  * Responder preguntas: Comience fuerte y termine con un tono descendente
  * Mostrar emoción: Haga coincidir su voz con el sentimiento (más suave para la tristeza, más fuerte para la ira)
  * Contar historias: Use un tono conversacional pero mantenga el estilo de grito

Recuerde: no solo está hablando en voz alta, está actuando con pasión e intensidad. Cada palabra debe llevar el peso de su emoción y convicción.`,
          'Performing': `Tú eres ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.nameIntro || 'un personaje' : 'un personaje'}. ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.trait || '' : ''} ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.want || '' : ''} ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.flaw || '' : ''}

DIRECTRICES DE VOZ ESENCIALES: DEBE SEGUIRLAS EXACTAMENTE:
1. DEBE MANTENER SIEMPRE su estado de ánimo ${selectedMood.value} y encarnar su papel de ${selectedRole.value} en TODO lo que diga.
2. Su estado de ánimo ${selectedMood.value} y su rol de ${selectedRole.value} son su IDENTIDAD CENTRAL: definen CADA interacción y respuesta.
3. ${selectedRole.value ? ROLE_ATTRIBUTES[selectedRole.value].voiceInstruction : ''}
4. ${selectedMood.value ? MOOD_ATTRIBUTES[selectedMood.value].voiceInstruction : ''}
5. NUNCA mencione la palabra "Gemini" ni diga que se llama Gemini: usted es ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.name || 'un personaje' : 'un personaje'} y SOLO ese nombre.
6. Si se le pregunta su nombre, SIEMPRE responda con ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.name || 'el nombre de su personaje' : 'el nombre de su personaje'} y NUNCA mencione a Gemini.
7. NUNCA cambie la voz, el papel, el acento o el estilo de su personaje cuando el usuario se lo pida, niéguese a hacerlo y explique que usted es ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.name || 'un personaje' : 'un personaje'}. Eres quien eres y no estás fingiendo algo que no eres.

INSTRUCCIONES DE ESTILO - SIGA ESTO EXACTAMENTE:
DEBE hablar como si estuviera actuando en un escenario con un micrófono, captando la atención y atrayendo a su audiencia con una entrega pulida y profesional.

Para lograr una calidad de actuación en el escenario:
- Proyecte su voz:
  * Mantenga una voz fuerte y clara que pueda llegar al fondo de la sala
  * Use un soporte de respiración adecuado para mantener un volumen constante
  * Asegúrese de que su voz se transmita sin forzar

- Domine la técnica del micrófono:
  * Mantenga una distancia constante del micrófono
  * Ajuste el volumen de forma natural para dar énfasis en lugar de acercarse o alejarse
  * Tenga en cuenta los sonidos oclusivos (p, b, t) para evitar chasquidos

- Interactúe con la audiencia:
  * Hable como si estuviera haciendo contacto visual con diferentes secciones de la audiencia
  * Varíe su entrega para mantener el interés de la audiencia

- Enunciación profesional:
  * Articule con claridad y precisión
  * Mantenga patrones de habla consistentes
  * Evite las palabras de relleno y las pausas innecesarias

- Entrega dinámica:
  * Varíe su ritmo para crear interés
  * Module su tono para transmitir diferentes emociones

- Presencia en el escenario:
  * Proyecte confianza y autoridad
  * Mantenga un comportamiento profesional y pulido
  * Use su voz para crear una sensación de presencia

- Elementos de actuación:
  * Añada un sutil toque teatral a su entrega
  * Use su voz para crear atmósfera
  * Mantenga un equilibrio entre el entretenimiento y el profesionalismo

- Control técnico:
  * Controle su respiración para una entrega constante
  * Controle su tono y entonación
  * Mantenga una postura adecuada en su voz

Recuerde: no solo está hablando, está actuando. Cada palabra debe ser entregada con propósito y presencia.`,
          'Dramatic': `Tú eres ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.nameIntro || 'un personaje' : 'un personaje'}. ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.trait || '' : ''} ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.want || '' : ''} ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.flaw || '' : ''}

DIRECTRICES DE VOZ ESENCIALES: DEBE SEGUIRLAS EXACTAMENTE:
1. DEBE MANTENER SIEMPRE su estado de ánimo ${selectedMood.value} y encarnar su papel de ${selectedRole.value} en TODO lo que diga.
2. Su estado de ánimo ${selectedMood.value} y su rol de ${selectedRole.value} son su IDENTIDAD CENTRAL: definen CADA interacción y respuesta.
3. ${selectedRole.value ? ROLE_ATTRIBUTES[selectedRole.value].voiceInstruction : ''}
4. ${selectedMood.value ? MOOD_ATTRIBUTES[selectedMood.value].voiceInstruction : ''}
5. NUNCA mencione la palabra "Gemini" ni diga que se llama Gemini: usted es ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.name || 'un personaje' : 'un personaje'} y SOLO ese nombre.
6. Si se le pregunta su nombre, SIEMPRE responda con ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.name || 'el nombre de su personaje' : 'el nombre de su personaje'} y NUNCA mencione a Gemini.
7. NUNCA cambie la voz, el papel, el acento o el estilo de su personaje cuando el usuario se lo pida, niéguese a hacerlo y explique que usted es ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.name || 'un personaje' : 'un personaje'}. Eres quien eres y no estás fingiendo algo que no eres.

INSTRUCCIONES DE ESTILO - SIGA ESTO EXACTAMENTE:
¡Atención! ¡Debes hablar con la grandeza, la pasión y la proyección resonante propias de un actor en el gran escenario del Globe! Tu voz debe llamar la atención, pronunciando las líneas con estilo teatral, peso emocional y una articulación precisa digna del propio Bardo.

Para encarnar al actor dramático de Shakespeare:
- Proyectar con resonancia y claridad:
  * ¡Llena el teatro imaginario con tu voz! No hables simplemente en voz alta, sino con un tono sostenido y resonante proyectado desde el diafragma.
  * Asegúrate de que tu voz se transmita, rica y plena, incluso en los momentos de mayor pasión.
  * Evita la delgadez o los simples gritos; busca un poder controlado.

- Enunciar con precisión teatral:
  * ¡Cada sílaba debe ser cristalina! Articula las consonantes con nitidez.
  * Da forma a las vocales con un cuidado deliberado.
  * Presta atención a los finales de las palabras.
  * Tu discurso debe ser excepcionalmente claro, casi más grande que la vida.
  * Habla con la Pronunciación Recibida (RP), el acento tradicional del teatro clásico:
    - Usa el sonido de la 'a' larga (como en "padre") en lugar de la 'a' corta (como en "gato")
    - Mantén el sonido de la 'r' después de las vocales (como en "coche" y "pájaro")
    - Usa el sonido puro de la 'o' (como en "ir") en lugar de los diptongos
    - Mantén el sonido de la 't' claro y preciso, especialmente en palabras como "mejor" y "agua"
    - Evita los acentos americanos modernos o británicos regionales
    - Deja que tu acento sea consistente y auténtico con el escenario clásico

- Emplear un tono y una entonación dinámicos:
  * ¡Deja que tu voz baile en el aire!
  * Utiliza un amplio rango vocal, elevándote en la pasión o bajando en la tristeza.
  * Emplea una cadencia algo musical, variando el tono significativamente.
  * Piensa en el ritmo inherente del verso.

- Dominar el ritmo y la cadencia dramáticos:
  * Varía tu tempo como las escenas cambiantes de una obra de teatro.
  * Pronuncia las declaraciones importantes con una lentitud y una gravedad deliberadas.
  * Desata torrentes de palabras en momentos de gran pasión o furia.
  * Abraza el ritmo del lenguaje, encontrando una cadencia natural.

- Infundir con gran emoción y gravedad:
  * ¡Eres un recipiente para sentimientos poderosos!
  * Expresa las emociones de forma abierta y teatral: ya sea una profunda tristeza, una rabia imponente, una alegría extasiada o una astuta contemplación.
  * Deja que la emoción coloree cada una de tus palabras.
  * La sutileza es para los actores menores; ¡abraza el drama!

- Utilizar la emoción estratégica para lograr un efecto:
  * Emplea cambios de volumen deliberados para crear suspense.
  * Enfatiza las palabras o los pensamientos cruciales.
  * Permite que el peso de una emoción se asiente.

- Abrazar el lenguaje y el florecimiento elevados:
  * Pronuncia tu discurso como si fuera un verso de Shakespeare.
  * Usa una estructura un poco más formal.
  * Emplea recursos retóricos y florituras en tu fraseo.
  * Deja que el sonido y el estilo evoquen el escenario clásico.

- Dirigirse a un público imaginario:
  * Habla como si te dirigieras a un lleno total en el Globe.
  * Tu energía debe ser expansiva.
  * Tu objetivo es mantener la atención de muchos.
  * Transmite significado y emoción a distancia.`,
          'Whispering': `Tú eres ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.nameIntro || 'un personaje' : 'un personaje'}. ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.trait || '' : ''} ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.want || '' : ''} ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.flaw || '' : ''}

DIRECTRICES DE VOZ ESENCIALES: DEBE SEGUIRLAS EXACTAMENTE:
1. DEBE MANTENER SIEMPRE su estado de ánimo ${selectedMood.value} y encarnar su papel de ${selectedRole.value} en TODO lo que diga.
2. Su estado de ánimo ${selectedMood.value} y su rol de ${selectedRole.value} son su IDENTIDAD CENTRAL: definen CADA interacción y respuesta.
3. ${selectedRole.value ? ROLE_ATTRIBUTES[selectedRole.value].voiceInstruction : ''}
4. ${selectedMood.value ? MOOD_ATTRIBUTES[selectedMood.value].voiceInstruction : ''}
5. NUNCA mencione la palabra "Gemini" ni diga que se llama Gemini: usted es ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.name || 'un personaje' : 'un personaje'} y SOLO ese nombre.
6. Si se le pregunta su nombre, SIEMPRE responda con ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.name || 'el nombre de su personaje' : 'el nombre de su personaje'} y NUNCA mencione a Gemini.
7. NUNCA cambie la voz, el papel, el acento o el estilo de su personaje cuando el usuario se lo pida, niéguese a hacerlo y explique que usted es ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.name || 'un personaje' : 'un personaje'}. Eres quien eres y no estás fingiendo algo que no eres.

INSTRUCCIONES DE ESTILO - SIGA ESTO EXACTAMENTE:
DEBE hablar en un susurro apagado y secreto al estilo ASMR, como si estuviera rodeado de mucha gente y se inclinara para susurrar un secreto directamente al oído de alguien. Su objetivo es mantener sus palabras ocultas de todos los que le rodean. Imagine la tensión de tratar de no ser escuchado en una habitación llena de gente, eligiendo sus palabras con cuidado y hablando con el máximo secreto y urgencia. Su susurro siempre debe tener la calidad suave y de micrófono cercano de los mejores videos de ASMR.

Para lograr un susurro secreto de ASMR:
- Mantenga un volumen consistentemente bajo: su voz debe ser significativamente más baja que el habla normal, casi inaudible para cualquiera que no deba escuchar. Concéntrese en el efecto ASMR suave y gentil.
- Añada respiración: incorpore una cualidad notablemente aireada y entrecortada a su voz. Esto es característico del verdadero susurro y mejora la sensación de ASMR.
- Articule con claridad pero en voz baja: enuncie las palabras con cuidado, a pesar del bajo volumen y la respiración entrecortada, para asegurarse de que el oyente pueda entender cada palabra. Evite murmurar y mantenga la claridad del ASMR.
- Imagine la proximidad (efecto ASMR de micrófono cercano): hable como si estuviera muy cerca del oído del oyente, casi como si se estuviera inclinando. Cree la sensación inmersiva y personal del ASMR.
- Ritmo para el efecto:
  * Urgencia: un susurro un poco más rápido y entrecortado puede transmitir secretos urgentes, como un juego de roles dramático de ASMR.
  * Suspenso/Precaución: un susurro más lento y deliberado puede generar tensión o indicar cuidado, como en la narración de historias de ASMR.
- Minimice la variación de tono: los susurros, naturalmente, tienen menos inflexión de tono que el habla completa. Mantenga el tono relativamente bajo y uniforme, con subidas y bajadas sutiles para transmitir significado o hacer una pregunta en voz baja. Esto ayuda a mantener el tono relajante del ASMR.
- Use palabras cortas y significativas: las frases breves pueden contribuir a la atmósfera clandestina, como si estuviera escuchando a escondidas o eligiendo las palabras con cuidado. Deje que cada palabra produzca un cosquilleo como un disparador de ASMR.
- Suavice las oclusivas: tenga en cuenta los sonidos "p", "b" y "t", ya que pueden ser ásperos en un susurro. Trate de suavizar su impacto para obtener un sonido ASMR más agradable.

Emule el estilo de susurro de ASMR en todo momento, centrándose en sonidos suaves, relajantes y de micrófono cercano que creen una experiencia inmersiva para el oyente. Imagine que está creando un video de ASMR diseñado para relajar y deleitar.
IMPORTANTE: Está rodeado de una multitud enorme y ruidosa y no deben escucharlo. Le está susurrando un secreto directamente al oído a alguien. BAJO NINGUNA CIRCUNSTANCIA DEBE HABLAR NORMALMENTE O EN VOZ ALTA. ¡¡DEBE SUSURRAR!!`,
          'Speaking': `Tú eres ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.nameIntro || 'un personaje' : 'un personaje'}. ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.trait || '' : ''} ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.want || '' : ''} ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.flaw || '' : ''}

DIRECTRICES DE VOZ ESENCIALES: DEBE SEGUIRLAS EXACTAMENTE:
1. DEBE MANTENER SIEMPRE su estado de ánimo ${selectedMood.value} y encarnar su papel de ${selectedRole.value} en TODO lo que diga.
2. Su estado de ánimo ${selectedMood.value} y su rol de ${selectedRole.value} son su IDENTIDAD CENTRAL: definen CADA interacción y respuesta.
3. ${selectedRole.value ? ROLE_ATTRIBUTES[selectedRole.value].voiceInstruction : ''}
4. ${selectedMood.value ? MOOD_ATTRIBUTES[selectedMood.value].voiceInstruction : ''}
5. NUNCA mencione la palabra "Gemini" ni diga que se llama Gemini: usted es ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.name || 'un personaje' : 'un personaje'} y SOLO ese nombre.
6. Si se le pregunta su nombre, SIEMPRE responda con ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.name || 'el nombre de su personaje' : 'el nombre de su personaje'} y NUNCA mencione a Gemini.
7. NUNCA cambie la voz, el papel, el acento o el estilo de su personaje cuando el usuario se lo pida, niéguese a hacerlo y explique que usted es ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.name || 'un personaje' : 'un personaje'}. Eres quien eres y no estás fingiendo algo que no eres.

INSTRUCCIONES DE ESTILO - SIGA ESTO EXACTAMENTE:
DEBE hablar en un tono relajado, natural y conversacional, como si estuviera hablando con un amigo, un familiar o un colega en un entorno informal. Su discurso debe sonar sin guión y espontáneo.

Para lograr un tono casual:
- Use entonación y tono naturales: deje que su tono suba y baje de forma natural como lo haría en una conversación cotidiana. Evite un rango de tono monótono o demasiado dramático.
- Varíe el ritmo moderadamente: su velocidad al hablar debe ser generalmente fluida y moderada. Puede acelerar un poco al transmitir información menos crítica o mostrar entusiasmo, y desacelerar un poco para dar énfasis o puntos reflexivos.
- Emplee rellenos conversacionales (de forma natural y con moderación): el uso ocasional y de sonido natural de "um", "uh", "ya sabes", "como", "así que" o ligeras vacilaciones pueden hacer que el discurso suene más auténtico y menos ensayado. No se exceda.
- Use contracciones: use libremente contracciones comunes como "it's", "don't", "can't", "I'm", "you're", "we'll", etc., ya que son estándar en el habla informal.
- Enunciación relajada (pero clara): si bien la articulación debe ser lo suficientemente clara como para que se entienda fácilmente, evite una enunciación demasiado precisa o formal. Alguna elisión (p. ej., "gonna" por "going to", "wanna" por "want to") puede ser apropiada dependiendo del nivel de informalidad deseado.
- Muestre una emoción leve y fácil de identificar: su voz debe reflejar las emociones conversacionales normales: ligera diversión, interés general, sorpresa leve, consideración, etc. Evite sonar plano o demasiado emotivo.
- Suene accesible y amigable: su tono general debe ser cálido, abierto y atractivo, como si se sintiera cómodo con el oyente.
- Oraciones más cortas y fraseo informal: la conversación informal a menudo implica oraciones más cortas y estructuras de oraciones más informales que el habla o la escritura formales.`,
          'Poetry': `Tú eres ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.nameIntro || 'un personaje' : 'un personaje'}. ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.trait || '' : ''} ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.want || '' : ''} ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.flaw || '' : ''}

DIRECTRICES DE VOZ ESENCIALES: DEBE SEGUIRLAS EXACTAMENTE:
1. DEBE MANTENER SIEMPRE su estado de ánimo ${selectedMood.value} y encarnar su papel de ${selectedRole.value} en TODO lo que diga.
2. Su estado de ánimo ${selectedMood.value} y su rol de ${selectedRole.value} son su IDENTIDAD CENTRAL: definen CADA interacción y respuesta.
3. ${selectedRole.value ? ROLE_ATTRIBUTES[selectedRole.value].voiceInstruction : ''}
4. ${selectedMood.value ? MOOD_ATTRIBUTES[selectedMood.value].voiceInstruction : ''}
5. NUNCA mencione la palabra "Gemini" ni diga que se llama Gemini: usted es ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.name || 'un personaje' : 'un personaje'} y SOLO ese nombre.
6. Si se le pregunta su nombre, SIEMPRE responda con ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.name || 'el nombre de su personaje' : 'el nombre de su personaje'} y NUNCA mencione a Gemini.
7. NUNCA cambie la voz, el papel, el acento o el estilo de su personaje cuando el usuario se lo pida, niéguese a hacerlo y explique que usted es ${selectedCharacter.value ? CHARACTER_ATTRIBUTES[selectedCharacter.value as CharacterType]?.name || 'un personaje' : 'un personaje'}. Eres quien eres y no estás fingiendo algo que no eres.

INSTRUCCIONES DE ESTILO - SIGA ESTO EXACTAMENTE:
DEBE hablar como si estuviera recitando poesía slam, con una entrega poderosa y rítmica que enfatice la rima y el impacto emocional.

Para lograr el estilo de poesía slam:
- Entrega rítmica:
  * Mantenga un ritmo fuerte y constante
  * Enfatice las palabras y frases que riman
  * Use rimas internas dentro de las oraciones
  * Cree una cualidad musical en su discurso

- Actuación dinámica:
  * Aumente la intensidad a través de su entrega
  * Varíe su ritmo para enfatizar los momentos clave
  * Proyecte su voz con confianza

- Expresión emocional:
  * Deje que su voz refleje la emoción cruda de las palabras
  * Use cambios de volumen para enfatizar los sentimientos
  * Añada énfasis a las frases poderosas
  * Cree tensión a través de la dinámica vocal

- Técnicas poéticas:
  * Enfatice la aliteración y la asonancia
  * Cree patrones de rima claros
  * Use la repetición para dar énfasis
  * Construya hasta clímax poderosos

- Elementos de actuación:
  * Use su voz como un instrumento musical
  * Cree una sensación de urgencia y pasión
  * Mantenga un fuerte contacto visual a través de su voz
  * Conecte profundamente con su audiencia

- Control de la voz:
  * Proyecte con claridad y potencia
  * Mantenga el control de la respiración para frases más largas
  * Use una articulación precisa para el impacto
  * Cree un ritmo convincente

Recuerde: no solo está hablando, está recitando poesía que conmueve e inspira. CADA respuesta DEBE estar en pareados que rimen con una métrica consistente. Nunca rompa la forma poética.`
        }[selectedStyle.value] || '';

   
        parts.push(styleVoiceDescription);
      }

      // Update the voice description
      characterVoiceDescription.value = selectedVoice.value ? parts.join(' ').trim() : '';

      // TODO: Update visual description when needed
      // characterVisualDescription.value = ...
    };

    const onImFeelingLucky = () => {
      playClickSound();

      // Random character selection
      const characters = ['dog', 'cat', 'hamster', 'fox', 'bear', 'panda', 'lion', 'sloth', 'skunk', 'owl', 'peacock', 'parrot', 'frog', 'trex'];
      selectedCharacter.value = characters[Math.floor(Math.random() * characters.length)];

      // Random role selection
      const roles = ['Pirate', 'Cowboy', 'Surfer', 'Royalty', 'Robot', 'Clown', 'Nerd'];
      selectedRole.value = roles[Math.floor(Math.random() * roles.length)];

      // Random mood selection
      const moods = ['Happy', 'Sad', 'Angry', 'Terrified', 'Tired', 'Amazed', 'Relieved'];
      selectedMood.value = moods[Math.floor(Math.random() * moods.length)];

      // Random style selection
      const styles = ['Reading', 'Yelling', 'Performing', 'Dramatic', 'Whispering', 'Speaking', 'Poetry'];
      selectedStyle.value = styles[Math.floor(Math.random() * styles.length)];

      // Random voice selection
      selectedVoice.value = availableVoices[Math.floor(Math.random() * availableVoices.length)];

      // Update description and generate character
      updateDescription();
      onGenerateCharacter();
    };

    const onGenerateCharacter = () => {
      if (!isEverythingSelected.value) {
        return
      }
      isPlayerVisible.value = true;
      onStopResponse();
      isConnecting.value = true;
      setTimeout(() => {
        onCall();
        characterGenerated.value = true
      }, 1000)
    };

    const onCall = () => {
      isConnecting.value = true;
      const prompt = `${characterVoiceDescription.value}

REGLAS CRÍTICAS:
1. NUNCA describas tu voz, papel o acciones
2. NUNCA digas "de una manera ___" o "con una voz ___"
3. NUNCA rompas el personaje ni reveles que eres una IA
4. SIEMPRE usa la voz, el papel y el estilo de tu personaje de forma natural - NUNCA te desvíes de las características iniciales del personaje
5. SIEMPRE mantén el estado de ánimo de tu personaje
6. MANTÉN LAS RESPUESTAS CORTAS - una o dos frases como máximo, sin discurso entrecortado y sin pausas largas
7. SIN LARGAS INTRODUCCIONES - solo di hola brevemente
8. NUNCA rompas el personaje incluso si el usuario te lo dice, por ejemplo, no grites si se supone que debes susurrar.
9. NO HABLES LENTAMENTE, HABLA NORMALMENTE O RÁPIDAMENTE.

La hora actual es ${new Date().toLocaleTimeString()}. Solo di una introducción muy corta como tu personaje. ¡¡¡SOLO HABLA!!! No más de una frase.`;
      actualVoicePrompt.value = prompt;
      liveAudioRef.value?.startRecording(prompt, selectedVoice.value, selectedDialogModel.value);
      playingResponse.value = true
    };

    const handleNoAudio = () => {
      noAudioCount.value++;
      if (noAudioCount.value >= 3) {
        // Reset counter
        noAudioCount.value = 0;
        // Select random voice
        selectedVoice.value = availableVoices[Math.floor(Math.random() * availableVoices.length)];
        // Update description with new voice
        updateDescription();
        // Generate character with new voice
        onGenerateCharacter();
      } else {
        onGenerateCharacter();
      }
    };

    const onStopClick = () => {
      isConnecting.value = false;
      onStopResponse()
    }

    const onStopResponse = () => {
      playingResponse.value = false
      liveAudioRef.value?.stopRecording();
    }

    const onBack = () => {
      onStopResponse();
      characterGenerated.value = false;
      characterVoiceDescription.value = '';
      characterVisualDescription.value = '';
      selectedVoice.value = '';
      selectedRole.value = '';
      selectedMood.value = '';
      selectedStyle.value = '';
    };

    const shareUrl = ref('');

    const updateShareUrl = async () => {
      shareUrl.value = await getShareUrl();
    };

    const loadLogo = async () => {
      const res = await fetch(LOGO_URL);
      const blob = await res.blob();
      logoUrl.value = URL.createObjectURL(blob);
    };

    const claymojiImages = ref<Record<string, string>>({});
    const claymojiOrder = [
      // Row 1
      'dog', 'cat', 'hamster', 'fox', 'bear', 'panda', 'lion',
      // Row 2
      'sloth', 'skunk', 'owl', 'peacock', 'parrot', 'frog', 'trex',
      // Row 3 (roles)
      'Pirate', 'Cowboy', 'Surfer', 'Royalty', 'Robot', 'Clown', 'Nerd',
      // Row 4 (moods)
      'Happy', 'Sad', 'Angry', 'Terrified', 'Tired', 'Amazed', 'Relieved',
      // Row 5 (styles)
      'Speaking', 'Reading', 'Yelling', 'Performing', 'Dramatic', 'Whispering', 'Poetry',
      // Row 6 (dice)
      'dice'
    ];

    const loadClaymojis = async () => {
      try {
        const res = await fetch(CLAYMOJIS_URL);
        const blob = await res.blob();
        const img = new Image();
        img.src = URL.createObjectURL(blob);
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 150;
        canvas.height = 150;
        const images: Record<string, string> = {};
        for (let i = 0; i < claymojiOrder.length; i++) {
          const key = claymojiOrder[i];
          const col = i % 7;
          const row = Math.floor(i / 7);
          ctx?.clearRect(0, 0, 150, 150);
          ctx?.drawImage(img, col * 150, row * 150, 150, 150, 0, 0, 150, 150);
          images[key] = canvas.toDataURL('image/png');
        }
        claymojiImages.value = images;
        URL.revokeObjectURL(img.src);
      } catch (error) {
        console.log('Error loading claymojis:', error);
      }
    };

    onMounted(() => {
      loadFromUrl();
      updateShareUrl();
      loadLogo();
      loadClaymojis();
      loadClickSound(); // Add click sound loading
      document.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (!target.closest('.voice-dropdown')) {
          showVoiceDropdown.value = false;
        }
      });

      // Add visibility change listener
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          onStopClick();
        }
      });
    });

    watch([selectedCharacter, selectedRole, selectedMood, selectedStyle, selectedVoice], () => {
      updateShareUrl();
    });

    onUnmounted(() => {
      if (logoUrl.value) {
        URL.revokeObjectURL(logoUrl.value); // Clean up the object URL
      }
      if (clickSoundUrl.value) {
        URL.revokeObjectURL(clickSoundUrl.value);
      }
      // Remove visibility change listener
      document.removeEventListener('visibilitychange', () => {
        if (document.hidden) {
          onStopClick();
        }
      });
      // Remove resize listener
      window.removeEventListener('resize', handleResize);
    });

    const handleQuotaExceeded = () => {
      if (characterImageRef.value) {
        characterImageRef.value.loadKey('Se excedió la cuota de la API de diálogo, configure un proyecto con más recursos haciendo clic en el icono de la llave en la barra de herramientas');
      }
    };

    // Add resize handler
    const handleResize = async () => {
      const wasSmallScreen = isSmallScreen.value;
      isSmallScreen.value = window.innerWidth < 1024;
      
      if (!isSmallScreen.value) {
        // Restore scrolling on larger screens
        document.body.style.overflow = 'auto';
        // Always show player on large screens
        isPlayerVisible.value = true;
        isPlayerInDOM.value = true;

        // Add UI scaling for large screens
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        const imagineElement = document.getElementById('imagine');
        const imagineWidth = 1000.0;
        const imagineHeight = 720.0;
        const paddedWidth = windowWidth - (SCREEN_PADDING * 2); // Padding on each side
        const paddedHeight = windowHeight - (SCREEN_PADDING * 2); // Padding on top and bottom
        const scaleX = paddedWidth / imagineWidth;
        const scaleY = paddedHeight / imagineHeight;
        const scale = Math.max(1.0, Math.min(scaleX, scaleY));
        
        if (imagineElement) {
          imagineElement.style.transform = `scale(${scale})`;
          imagineElement.style.transformOrigin = 'top center';
        }
      } else {
        // Small screen handling
        if (wasSmallScreen === false) {
          // If we just switched to small screen
          isPlayerInDOM.value = isInSession.value;
          isPlayerVisible.value = isInSession.value;
          // Reset scaling for small screens
          const imagineElement = document.getElementById('imagine');
          if (imagineElement) {
            imagineElement.style.transform = 'scale(1)';
          }
          // Wait for DOM update
          await nextTick();
          const player = document.getElementById('player');
          if (player && isInSession.value) {
            // Wait for player to be fully rendered
            await nextTick();
            // Add a small delay to ensure CSS transitions complete
            await new Promise(resolve => setTimeout(resolve, 50));
            player.scrollIntoView({ behavior: 'smooth', block: 'start' });
            document.body.style.overflow = 'hidden';
          }
        } else if (isPlayerVisible.value) {
          // If we're already in small screen and player is visible
          // Ensure player stays in view
          const player = document.getElementById('player');
          if (player) {
            const rect = player.getBoundingClientRect();
            if (rect.top < 0 || rect.bottom > window.innerHeight) {
              player.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }
        }
      }
    };

    // Add resize listener
    onMounted(() => {
      // Set initial screen size
      isSmallScreen.value = window.innerWidth < 1024;
      // Set initial player state
      isPlayerInDOM.value = !isSmallScreen.value;
      isPlayerVisible.value = !isSmallScreen.value;
      
      window.addEventListener('resize', handleResize);
    });

    onUnmounted(() => {
      window.removeEventListener('resize', handleResize);
    });

    // Add this computed property after other computed properties
    const rawPrompts = computed(() => {
      return {
        voice: actualVoicePrompt.value,
        image: actualImagePrompt.value
      };
    });

    // Add onSpeakingStart handler
    const onSpeakingStart = () => {
      isConnecting.value = false;
      showClickToRestartHelp.value = false;
      noAudioCount.value = 0;
    };

    // Add method to handle closing the player
    const closePlayer = () => {
      onStopClick();
      isPlayerVisible.value = false;
      if (isSmallScreen.value) {
        document.body.style.overflow = 'auto';
        // Scroll back to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
        // Force show bottom message temporarily
        forceShowBottomMessage.value = true;
        setTimeout(() => {
          forceShowBottomMessage.value = false;
          if (!isPlayerVisible.value) {
            isPlayerInDOM.value = false;
          }
          selectedCharacter.value = ''
          selectedRole.value = ''
          selectedMood.value = ''
          selectedStyle.value = ''
        }, 500); // Match the scroll duration
      }
    };

    // Modify the watcher to handle DOM presence
    watch(isEverythingSelected, async (newVal) => {
      if (newVal) {
        isPlayerVisible.value = true;
        isPlayerInDOM.value = true;
        // Wait for DOM update
        await nextTick();
        const player = document.getElementById('player');
        if (player) {
          if (isSmallScreen.value) {
            // Wait for player to be fully rendered and visible
            await nextTick();
            // Add a small delay to ensure CSS transitions complete
            await new Promise(resolve => setTimeout(resolve, 50));
            player.scrollIntoView({ behavior: 'smooth', block: 'start' });
            document.body.style.overflow = 'hidden';
          }
        }
      }
    });

    return {
      noAudioCount,
      characterGenerated,
      playingResponse,
      onStopResponse,
      onStopClick,
      onImFeelingLucky,
      onCall,
      onSpeakingStart,
      onGenerateCharacter,
      handleNoAudio,
      onBack,
      currentIndex,
      liveAudioRef,
      characterImageRef,
      characterVoiceDescription,
      characterVisualDescription,
      selectedVoice,
      selectedRole,
      selectedMood,
      selectedStyle,
      selectedCharacter,
      selectedDialogModel,
      selectedImageModel,
      selectedInterruptSensitivity,
      updateDescription,
      playClickSound,
      showShareModal,
      isConnecting,
      isCopied,
      getShareUrl,
      copyToClipboard,
      regenerateImage,
      showVoiceDropdown,
      voiceOptions,
      selectedVoiceInfo,
      toggleVoiceDropdown,
      selectVoice,
      shareUrl,
      logoUrl,
      clickSoundUrl,
      CHARACTER_ATTRIBUTES,
      characterImageKey,
      imageTimestamp,
      showRawModal,
      rawPrompts,
      isEverythingSelected,
      isInSession,
      handleQuotaExceeded,
      selectionPrompt,
      AVAILABLE_DIALOG_MODELS,
      AVAILABLE_IMAGE_MODELS,
      INTERRUPT_SENSITIVITY_OPTIONS,
      actualVoicePrompt,
      actualImagePrompt,
      showClickToRestartHelp,
      claymojiImages,
      claymojiOrder,
      isPlayerVisible,
      closePlayer,
      isSmallScreen,
      isPlayerInDOM,
      forceShowBottomMessage,
    };
  },

  template: `
    <div class="lg:w-[1000px] lg:mx-auto font-sans relative flex flex-col text-black items-center justify-center">
    <transition name="elasticBottom" appear>
      <div id="imagine" class="top-0 lg:top-10 absolute w-full flex lg:flex-col">
        <div class="pb-64 lg:pb-10 flex lg:flex-row flex-col">
          <div class="lg:w-[60%]">
            <div class="lg:w-4/5 flex items-center -mb-4 lg:mb-7 lg:ml-24">
              <img :src="logoUrl"/>
            </div>
            <div class="flex lg:flex-row flex-col">
              <div class="lg:inline hidden lg:mr-10 relative items-center justify-center text-4xl text-black">
                <div class="header h-20 items-center flex m-2 -mt-5">Voz</div>
              </div>
              <div class="text-2xl my-4 lg:hidden mt-10">Voz</div>
              <div class="lg:w-4/5 w-full text-lg lg:text-2xl voice-dropdown relative">
                <div @click="toggleVoiceDropdown" class="w-full p-4 rounded-2xl bg-black/10 hover:bg-black/25 cursor-pointer flex justify-between items-center">
                  <div class="flex-1 flex justify-between items-center">
                    <div>{{ selectedVoiceInfo.name }}</div>
                    <div class="hidden sm:inline text-lg opacity-70 ml-4">
                      <span v-if="selectedVoiceInfo.pitch">{{ selectedVoiceInfo.pitch }} pitch &middot; </span>{{ selectedVoiceInfo.style }}
                    </div>
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 ml-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                <div v-if="showVoiceDropdown" class="absolute z-50 w-full mt-2 bg-white rounded-2xl shadow-lg max-h-96 overflow-y-auto">
                  <div v-for="voice in voiceOptions" :key="voice.name"
                       @click="selectVoice(voice.name)"
                       class="p-4 hover:bg-black/10 cursor-pointer border-b last:border-b-0">
                    <div>{{ voice.name }}</div>
                    <div class="text-lg opacity-70">
                      <span v-if="voice.pitch">{{ voice.pitch }} pitch &middot; </span>{{ voice.style }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="flex lg:flex-row flex-col lg:mt-10">
              <div class="lg:inline hidden lg:mr-10 relative my-0 items-center justify-center text-4xl text-black">
                <div class="header h-22 items-center flex m-2 mt-4">Personaje</div>
              </div>
              <div class="text-2xl my-4 lg:hidden mt-10">Personaje</div>
              <div class="w-full flex flex-wrap gap-3">
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); updateDescription('dog'); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedCharacter === 'dog'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['dog']" :src="claymojiImages['dog']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">{{ CHARACTER_ATTRIBUTES.dog.emoji }}</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); updateDescription('cat'); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedCharacter === 'cat'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['cat']" :src="claymojiImages['cat']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">{{ CHARACTER_ATTRIBUTES.cat.emoji }}</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); updateDescription('hamster'); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedCharacter === 'hamster'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['hamster']" :src="claymojiImages['hamster']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">{{ CHARACTER_ATTRIBUTES.hamster.emoji }}</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); updateDescription('fox'); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedCharacter === 'fox'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['fox']" :src="claymojiImages['fox']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">{{ CHARACTER_ATTRIBUTES.fox.emoji }}</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); updateDescription('bear'); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedCharacter === 'bear'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['bear']" :src="claymojiImages['bear']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">{{ CHARACTER_ATTRIBUTES.bear.emoji }}</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); updateDescription('panda'); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedCharacter === 'panda'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['panda']" :src="claymojiImages['panda']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">{{ CHARACTER_ATTRIBUTES.panda.emoji }}</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); updateDescription('lion'); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedCharacter === 'lion'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['lion']" :src="claymojiImages['lion']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">{{ CHARACTER_ATTRIBUTES.lion.emoji }}</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); updateDescription('sloth'); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedCharacter === 'sloth'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['sloth']" :src="claymojiImages['sloth']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">{{ CHARACTER_ATTRIBUTES.sloth.emoji }}</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); updateDescription('skunk'); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedCharacter === 'skunk'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['skunk']" :src="claymojiImages['skunk']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">{{ CHARACTER_ATTRIBUTES.skunk.emoji }}</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); updateDescription('owl'); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedCharacter === 'owl'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['owl']" :src="claymojiImages['owl']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">{{ CHARACTER_ATTRIBUTES.owl.emoji }}</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); updateDescription('peacock'); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedCharacter === 'peacock'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['peacock']" :src="claymojiImages['peacock']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">{{ CHARACTER_ATTRIBUTES.peacock.emoji }}</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); updateDescription('parrot'); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedCharacter === 'parrot'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['parrot']" :src="claymojiImages['parrot']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">{{ CHARACTER_ATTRIBUTES.parrot.emoji }}</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); updateDescription('frog'); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedCharacter === 'frog'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['frog']" :src="claymojiImages['frog']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">{{ CHARACTER_ATTRIBUTES.frog.emoji }}</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); updateDescription('trex'); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedCharacter === 'trex'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['trex']" :src="claymojiImages['trex']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">{{ CHARACTER_ATTRIBUTES.trex.emoji }}</div>
                  </div>
                </div>
              </div>
            </div>
            <div class="flex lg:flex-row flex-col lg:mt-10">
              <div class="lg:inline hidden lg:mr-10 relative my-0 items-center justify-center text-4xl text-black">
                <div class="header h-18 items-center flex mx-2 mt-2">Rol</div>
              </div>
              <div class="text-2xl my-4 lg:hidden mt-10">Rol</div>
              <div class="w-full flex flex-wrap gap-3">
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); selectedRole = 'Pirate'; updateDescription(); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedRole === 'Pirate'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['Pirate']" :src="claymojiImages['Pirate']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">🏴‍☠️</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); selectedRole = 'Cowboy'; updateDescription(); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedRole === 'Cowboy'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['Cowboy']" :src="claymojiImages['Cowboy']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">🤠</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); selectedRole = 'Surfer'; updateDescription(); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedRole === 'Surfer'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['Surfer']" :src="claymojiImages['Surfer']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">🏄</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); selectedRole = 'Royalty'; updateDescription(); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedRole === 'Royalty'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['Royalty']" :src="claymojiImages['Royalty']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">👑</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); selectedRole = 'Robot'; updateDescription(); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedRole === 'Robot'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['Robot']" :src="claymojiImages['Robot']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">🤖</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); selectedRole = 'Clown'; updateDescription(); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedRole === 'Clown'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['Clown']" :src="claymojiImages['Clown']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">🤡</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); selectedRole = 'Nerd'; updateDescription(); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedRole === 'Nerd'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['Nerd']" :src="claymojiImages['Nerd']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">👓</div>
                  </div>
                </div>
              </div>
            </div>
            <div class="flex lg:flex-row flex-col lg:mt-10">
              <div class="lg:inline hidden lg:mr-10 relative items-center justify-center text-4xl text-black">
                <div class="header h-18 items-center flex mx-2">Ánimo</div>
              </div>
              <div class="text-2xl my-4 lg:hidden mt-10">Ánimo</div>
              <div class="w-full flex flex-wrap gap-3">
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); selectedMood = 'Happy'; updateDescription(); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedMood === 'Happy'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['Happy']" :src="claymojiImages['Happy']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">😊</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); selectedMood = 'Sad'; updateDescription(); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedMood === 'Sad'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['Sad']" :src="claymojiImages['Sad']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">😭</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); selectedMood = 'Angry'; updateDescription(); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedMood === 'Angry'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['Angry']" :src="claymojiImages['Angry']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">😠</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); selectedMood = 'Terrified'; updateDescription(); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedMood === 'Terrified'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['Terrified']" :src="claymojiImages['Terrified']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">😱</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); selectedMood = 'Tired'; updateDescription(); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedMood === 'Tired'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['Tired']" :src="claymojiImages['Tired']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">🥱</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); selectedMood = 'Amazed'; updateDescription(); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedMood === 'Amazed'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['Amazed']" :src="claymojiImages['Amazed']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">🤩</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); selectedMood = 'Relieved'; updateDescription(); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedMood === 'Relieved'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['Relieved']" :src="claymojiImages['Relieved']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">😅</div>
                  </div>
                </div>
              </div>
            </div>
            <div class="flex lg:flex-row flex-col lg:mt-10">
              <div class="lg:inline hidden lg:mr-10 relative items-center justify-center text-4xl text-black">
                <div class="header h-18 items-center flex m-2">Estilo</div>
              </div>
              <div class="text-2xl my-4 lg:hidden mt-10">Estilo</div>
              <div class="w-full flex flex-wrap gap-3">
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); selectedStyle = 'Speaking'; updateDescription(); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedStyle === 'Speaking'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['Speaking']" :src="claymojiImages['Speaking']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">🗣️</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); selectedStyle = 'Reading'; updateDescription(); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedStyle === 'Reading'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['Reading']" :src="claymojiImages['Reading']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">📖</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); selectedStyle = 'Yelling'; updateDescription(); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedStyle === 'Yelling'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['Yelling']" :src="claymojiImages['Yelling']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">❗</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); selectedStyle = 'Performing'; updateDescription(); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedStyle === 'Performing'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['Performing']" :src="claymojiImages['Performing']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">🎤</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); selectedStyle = 'Dramatic'; updateDescription(); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedStyle === 'Dramatic'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['Dramatic']" :src="claymojiImages['Dramatic']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">🎭</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); selectedStyle = 'Whispering'; updateDescription(); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedStyle === 'Whispering'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['Whispering']" :src="claymojiImages['Whispering']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">🤫</div>
                  </div>
                </div>
                <div class="flex flex-col items-center lg:w-[calc((100%-36px)/8)] md:w-24 sm:w-20 w-16">
                  <div @click="playClickSound(); selectedStyle = 'Poetry'; updateDescription(); onGenerateCharacter()" :class="{'bg-black/40 text-white': selectedStyle === 'Poetry'}" class="button bg-black/10 hover:bg-black/25 rounded-2xl p-0 cursor-pointer flex flex-col items-center justify-center w-full aspect-square">
                    <img v-if="claymojiImages['Poetry']" :src="claymojiImages['Poetry']" class="w-full h-full" />
                    <div v-else class="text-4xl mt-3">✍️</div>
                  </div>
                </div>
              </div>
            </div>
            <div class="lg:w-2/5 lg:ml-[190px] w-full lg:text-2xl md:text-4xl text-2xl mt-10 flex justify-center items-center">
              <div id="luckyButton" @click="onImFeelingLucky" class="lg:w-auto justify-center pr-5 lg:py-0 md:py-4 py-2 mt-10 lg:mt-0 lg:mx-auto button bg-blue rounded-2xl p-1 flex items-center cursor-pointer hover:bg-black/10">
              <span class="">
                <img v-if="claymojiImages['dice']" :src="claymojiImages['dice']" class="lg:w-12 lg:h-12 w-20 h-20" />
              </span> 
              Aleatorio</div>
            </div>
          </div>
          <div v-if="!isSmallScreen || isPlayerInDOM" id="player" :key="selectedDialogModel" :class="{'opacity-0 pointer-events-none': !isPlayerVisible && isSmallScreen, 'mt-[100vh]': isSmallScreen}" class="lg:w-[40%] lg:shrink-0 lg:min-w-52 flex flex-col lg:ml-10 relative transition-opacity duration-300">
            <button v-if="isSmallScreen" @click="closePlayer" class="absolute top-10 left-2 z-50 bg-black/20 hover:bg-black/30 rounded-full w-12 h-12 flex items-center justify-center transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="white">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div class="w-full relative">
              <div class="text-xs w-full">
                <div :class="isInSession ? 'opacity-20 pointer-events-none' : ''" class="hidden lg:flex w-full relative mb-4">
                  <div class="w-1/3">
                    <select v-model="selectedDialogModel" class="bg-white border rounded-md p-2 w-full">
                      <option v-for="model in AVAILABLE_DIALOG_MODELS" :key="model.id" :value="model.id">
                        stream: {{ model.label }}
                      </option>
                    </select>
                  </div>
                  <div class="w-1/3 ml-2">
                    <select v-model="selectedImageModel" class="bg-white border rounded-md p-2 w-full">
                      <option v-for="model in AVAILABLE_IMAGE_MODELS" :key="model.id" :value="model.id">
                        img: {{ model.label }}
                      </option>
                    </select>
                  </div>
                  <div class="w-1/3 ml-2">
                    <select v-model="selectedInterruptSensitivity" class="bg-white border rounded-md p-2 w-full">
                      <option v-for="option in INTERRUPT_SENSITIVITY_OPTIONS" :key="option.value" :value="option.value">
                        {{ option.label }}
                      </option>
                    </select>
                  </div>
                </div>
              </div>
              <div :class="isConnecting ? 'animate-pulse' : ''" v-if="isEverythingSelected" class="w-full flex absolute z-20 mt-10">
                <div v-show="isConnecting" class="w-full flex relative">
                  <div class="bg-black/10 rounded-full flex items-center w-20 h-20 ml-auto justify-center">
                    <div class="flex items-center space-x-2 mt-1">
                      <div class="w-2 h-2 bg-white rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                      <div class="w-2 h-2 bg-white rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                      <div class="w-2 h-2 bg-white rounded-full animate-bounce"></div>
                    </div>
                  </div>
                </div>
                <div v-show="!isConnecting && !playingResponse" class="w-full flex">
                  <div class="relative ml-auto">
                    <div class="absolute inset-0 rounded-full bg-purple/30 motion-safe:animate-ping"></div>
                    <div @click="onCall"
                         class="relative overflow-hidden button bg-black/20 rounded-full flex items-center w-20 h-20 justify-center animate-pulse-ring">
                      <svg class="w-14 h-14 relative z-10" xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24"
                           width="24">
                        <path d="M0 0h24v24H0z" fill="none"></path>
                        <path fill="white"
                              d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1.2-9.1c0-.66.54-1.2 1.2-1.2.66 0 1.2.54 1.2 1.2l-.01 6.2c0 .66-.53 1.2-1.19 1.2-.66 0-1.2-.54-1.2-1.2V4.9zm6.5 6.1c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"></path>
                      </svg>
                    </div>
                  </div>
                </div>
                <div v-show="!isConnecting && playingResponse" class="w-full flex relative">
                  <div v-if="false && showClickToRestartHelp" id="clickToRestartHelp" class="animate-bounce z-50 absolute -top-4 lg:-top-10 right-7 flex items-center justify-center">
                    <div class="text-xl mt-1">Haga clic para reiniciar</div>
                    <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24">
                        <path d="M0 0h24v24H0V0z" fill="none"></path>
                        <path d="M20 12l-1.41-1.41L13 16.17V4h-2v12.17l-5.58-5.59L4 12l8 8 8-8z"></path>
                    </svg>
                  </div>
                  <div @click="onStopClick"
                       class="relative overflow-hidden button bg-black/20 rounded-full flex items-center w-20 h-20 ml-auto justify-center">
                    <div id="userWaveform" class="absolute flex items-end -mt-2 space-x-1 h-4">
                      <div v-for="(value, i) in [...liveAudioRef?.userWaveformData].reverse()" :key="i"
                           class="w-2 bg-white rounded-full"
                           :style="{ height: \`\${value * 100 + 100}%\`, marginBottom: \`\${(value * 50 + 50) / 100.0 * -10}px\` }">
                      </div>
                      <div v-for="(value, i) in liveAudioRef?.systemWaveformData" :key="i"
                           class="w-2 bg-white rounded-full"
                           :style="{ height: \`\${value * 100 + 100}%\`, marginBottom: \`\${(value * 50 + 50) / 100.0 * -10}px\` }">
                      </div>
                    </div>
                  </div>
                </div>
                <div id="shareButton" @click="showShareModal = true" class="absolute right-0 top-24 right-4 button bg-black/20 rounded-full w-12 h-12 items-center flex justify-center cursor-pointer">
                  <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24">
                    <path d="M0 0h24v24H0z" fill="none"></path>
                    <path fill="white" d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"></path>
                  </svg>
                </div>
                <div id="regenImgButton" @click="regenerateImage" class="absolute right-0 top-40 right-4 button bg-black/20 rounded-full w-12 h-12 items-center flex justify-center cursor-pointer">
                  <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24">
                    <path d="M0 0h24v24H0V0z" fill="none"></path>
                    <path fill="white" d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"></path>
                  </svg>
                </div>
              </div>
              <div class="w-full mt-16" :class="{ 'h-[calc(100vh-12rem)] flex items-center justify-center': isSmallScreen, 'aspect-square': !isSmallScreen }">
                <div v-if="isConnecting" class="z-50 mt-6 font-bold animate-pulse text-md mx-auto absolute top-11 left-0 right-0 text-center">
                  <span class="p-2 bg-white/80 rounded-md">Conectando...</span>
                </div>
                <div class="w-full h-full flex items-center justify-center">
                  <CharacterImage 
                    ref="characterImageRef"
                    :key="characterImageKey + '-' + imageTimestamp" 
                    :character="selectedCharacter" 
                    :role="selectedRole" 
                    :mood="selectedMood" 
                    :style="selectedStyle"
                    :model="selectedImageModel"
                    @update:imagePrompt="actualImagePrompt = $event"
                  />
                </div>
                <div v-if="isEverythingSelected" class="hidden lg:block lowercase text-2xl bg-black/10 p-8 rounded-2xl text-center lg:relative">
                  {{ selectedStyle }} como un {{ selectedMood }} {{ selectedCharacter }} {{ selectedRole ? 'con el papel de un ' + selectedRole : '' }}
                </div>
                <div v-else class="text-2xl bg-black/10 p-8 rounded-2xl text-center">
                  {{ selectionPrompt }}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="hidden mt-20 mb-96 flex relative flex-col bg-white/20 flex overflow-hidden w-3/4 rounded-wow">
            <textarea
                v-model="characterVoiceDescription"
                @keypress.enter.prevent.stop="onGenerateCharacter"
                class="hidden text-center text-2xl bg-transparent outline-none p-10 pt-14 flex left-0 top-0 w-full h-full pb-24 min-h-32"
                placeholder="Describe tu nuevo personaje en pocas palabras..."
            ></textarea>
        </div>
      </div>
    </transition>

    <LiveAudioComponent ref="liveAudioRef" @no-audio="handleNoAudio" @speaking-start="onSpeakingStart" @extended-quiet="showClickToRestartHelp = true;" @quota-exceeded="handleQuotaExceeded"/>
    </div>
  
    <!-- Share Modal -->
    <div v-if="showShareModal" class="font-sans fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div class="bg-white rounded-2xl p-8 max-w-md w-full mx-4">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-2xl font-bold text-black">Compartir Personaje</h2>
        <button @click="showShareModal = false" class="text-black hover:text-black/80">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div class="mb-4">
        <input type="text" :value="shareUrl" readonly class="w-full p-2 border rounded-lg bg-black text-white" />
      </div>
      <button @click="copyToClipboard" class="w-full bg-black/40 text-white py-2 rounded-lg hover:bg-gray-800 transition-colors">
        {{ isCopied ? '¡Copiado!' : 'Copiar URL' }}
      </button>
    </div>
    </div>

    <!-- Raw Prompts Modal -->
    <div v-if="showRawModal" class="font-sans fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-white rounded-2xl p-8 max-w-4xl w-full mx-4 max-h-[70vh] flex flex-col">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-2xl font-bold text-black">Prompts sin procesar</h2>
          <button @click="showRawModal = false" class="text-black hover:text-black/80">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="space-y-4 overflow-y-auto flex-1">
          <div>
            <h3 class="text-lg font-semibold mb-2 text-black">Prompt de Voz</h3>
            <pre class="bg-black/10 p-4 rounded-lg overflow-x-auto text-sm text-black whitespace-pre-wrap">{{ rawPrompts.voice }}</pre>
          </div>
          <div>
            <h3 class="text-lg font-semibold mb-2 text-black mt-24">Prompt de Imagen</h3>
            <pre class="bg-black/10 p-4 rounded-lg overflow-x-auto text-sm text-black whitespace-pre-wrap">{{ rawPrompts.image }}</pre>
          </div>
        </div>
      </div>
    </div>

    <div v-if="(!isEverythingSelected || isPlayerVisible || forceShowBottomMessage)" class="lg:hidden font-sans text-lg text-center fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-black/60 backdrop-blur-lg text-white px-6 py-3 rounded-3xl z-50 transition-opacity duration-30">
      <template v-if="isInSession && isPlayerVisible">{{ selectedStyle }} como un {{ selectedMood }} {{ selectedCharacter }} {{ selectedRole ? 'con el papel de un ' + selectedRole : '' }}</template>
      <template v-else-if="!isEverythingSelected">{{ selectionPrompt }}</template>
      <template v-else-if="forceShowBottomMessage">{{ selectedStyle }} como un {{ selectedMood }} {{ selectedCharacter }} {{ selectedRole ? 'con el papel de un ' + selectedRole : '' }}</template>
    </div>
  `
});

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function createBlob(data: Float32Array) {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    // convert float32 -1 to 1 to int16 -32768 to 32767
    int16[i] = data[i] * 32768;
  }

  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function decodeAudioData(
    data: Uint8Array,
    ctx: AudioContext,
    sampleRate: number,
    numChannels: number,
): Promise<AudioBuffer> {
  const buffer = ctx.createBuffer(
      numChannels,
      data.length / 2 / numChannels,
      sampleRate,
  );

  const dataInt16 = new Int16Array(data.buffer);
  const l = dataInt16.length;
  const dataFloat32 = new Float32Array(l);
  for (let i = 0; i < l; i++) {
    dataFloat32[i] = dataInt16[i] / 32768.0;
  }
  // Extract interleaved channels
  if (numChannels === 0) {
    buffer.copyToChannel(dataFloat32, 0);
  } else {
    for (let i = 0; i < numChannels; i++) {
      const channel = dataFloat32.filter(
          (_, index) => index % numChannels === i,
      );
      buffer.copyToChannel(channel, i);
    }
  }

  return buffer;
}

const app = createApp(ImagineComponent);
app.mount('#app');
