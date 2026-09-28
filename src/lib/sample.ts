import type { CanonicalModel, LessonContent } from "./types";

/**
 * Curated sample source: "Newton's Laws of Motion".
 * Used when a learner taps "Try the sample" — it runs through the same pipeline as uploads.
 * When Gemini is unavailable this hand-authored canonical model guarantees a high-quality demo.
 */
export const SAMPLE_FILE_NAME = "Newtons-Laws-of-Motion.pdf";

export const SAMPLE_MODEL: CanonicalModel = {
  title: "Newton's Laws of Motion",
  subject: "Physics",
  summary:
    "An introduction to how and why objects move: describing motion, the idea of force, Newton's three laws, and how to apply them to real problems.",
  chapters: [
    { title: "Describing Motion", summary: "Position, velocity, acceleration and mass — the language we need before talking about forces.", pageStart: 1 },
    { title: "Force and Newton's Laws", summary: "What a force is, balanced and unbalanced forces, and Newton's three laws of motion.", pageStart: 5 },
    { title: "Applying Newton's Laws", summary: "Weight, friction, free-body diagrams, momentum and everyday applications.", pageStart: 11 },
  ],
  objectives: [
    { chapter: 0, title: "Describe motion using velocity and acceleration", description: "Explain the difference between speed, velocity and acceleration and interpret them in everyday motion.", bloom: "Understand" },
    { chapter: 1, title: "Understand Newton's three laws of motion", description: "State each law in your own words and recognise it in real situations.", bloom: "Understand" },
    { chapter: 1, title: "Apply F = ma to calculate force, mass and acceleration", description: "Use Newton's second law to solve quantitative problems with correct units.", bloom: "Apply" },
    { chapter: 2, title: "Solve real-world problems with forces", description: "Draw free-body diagrams and reason about friction, weight and momentum in real situations.", bloom: "Analyze" },
  ],
  concepts: [
    {
      name: "Motion and Position", chapter: 0, objective: 0, level: "prerequisite", difficulty: 1,
      summary: "Motion is a change in position over time, always measured relative to a reference point.",
      definition: "Motion is the change in an object's position with time, measured relative to a chosen reference point.",
      formulas: [], examples: ["A bus moving away from a bus stop is in motion relative to the stop, but a passenger sitting inside is at rest relative to the bus."],
      facts: ["Position needs a reference point.", "Distance is how much ground is covered; displacement is the straight-line change in position with a direction."],
      misconceptions: ["Something is either moving or not moving, no matter who observes it."],
      prerequisites: [], related: ["Velocity"], analogy: "Describing position is like giving directions: 'two shops left of the temple' only makes sense if everyone knows where the temple is.",
      sourcePage: 1, sourceSection: "1.1 Position and reference points",
    },
    {
      name: "Velocity", chapter: 0, objective: 0, level: "basic", difficulty: 2,
      summary: "Velocity is speed with a direction.",
      definition: "Velocity is the rate of change of position — how fast something moves and in which direction.",
      formulas: ["v = Δx / Δt"], examples: ["A car travelling 60 km/h north has a different velocity from a car travelling 60 km/h south, even though their speeds are equal."],
      facts: ["Velocity is a vector: it has size and direction.", "Unit: metres per second (m/s)."],
      misconceptions: ["Speed and velocity are exactly the same thing."],
      prerequisites: ["Motion and Position"], related: ["Acceleration"], analogy: "Speed tells you how fast the auto-rickshaw is going; velocity also tells you whether it's going towards your home or away from it.",
      sourcePage: 2, sourceSection: "1.2 Speed and velocity",
    },
    {
      name: "Acceleration", chapter: 0, objective: 0, level: "core", difficulty: 2,
      summary: "Acceleration is how quickly velocity changes.",
      definition: "Acceleration is the rate at which an object's velocity changes — speeding up, slowing down, or changing direction.",
      formulas: ["a = Δv / Δt"], examples: ["A cricket ball speeding up as it's thrown, a bike braking at a signal, and a car turning a corner at constant speed are all accelerating."],
      facts: ["Unit: metres per second squared (m/s²).", "Turning at constant speed is still acceleration because direction changes."],
      misconceptions: ["Acceleration only means speeding up.", "A fast object must have a large acceleration."],
      prerequisites: ["Velocity"], related: ["Newton's Second Law", "Force"], analogy: "Velocity is how fast the lift is moving; acceleration is the stomach-drop feeling when it starts or stops.",
      sourcePage: 3, sourceSection: "1.3 Acceleration",
    },
    {
      name: "Mass", chapter: 0, objective: 0, level: "basic", difficulty: 1,
      summary: "Mass is the amount of matter in an object and a measure of how hard it is to change its motion.",
      definition: "Mass is the amount of matter in an object; it measures how strongly the object resists changes to its motion.",
      formulas: [], examples: ["An empty shopping trolley is easy to start pushing; a full one is much harder because it has more mass."],
      facts: ["Unit: kilogram (kg).", "Mass does not change from place to place — it is the same on Earth and on the Moon."],
      misconceptions: ["Mass and weight are the same thing.", "Mass is a push or pull on an object."],
      prerequisites: [], related: ["Inertia", "Weight and Mass"], analogy: "Mass is how much 'stuff' is packed into something — a bag of rice versus a bag of cotton of the same size.",
      sourcePage: 4, sourceSection: "1.4 Mass",
    },
    {
      name: "Force", chapter: 1, objective: 1, level: "core", difficulty: 2,
      summary: "A force is a push or a pull that can change an object's motion or shape.",
      definition: "A force is a push or pull on an object resulting from its interaction with another object; it can change the object's speed, direction or shape.",
      formulas: ["Unit: 1 newton (N) = 1 kg·m/s²"], examples: ["Kicking a football, pulling open a door, and the Earth pulling an apple downward are all forces."],
      facts: ["Force is a vector: it has size and direction.", "Forces always come from an interaction between two objects.", "Contact forces (friction, push) and non-contact forces (gravity, magnetism) both exist."],
      misconceptions: ["A force is needed to keep an object moving.", "Force is the same as mass."],
      prerequisites: ["Mass", "Acceleration"], related: ["Net Force", "Newton's Second Law"], analogy: "Imagine pushing a shopping cart in a supermarket. Your push is the force — it's what gets the cart rolling, speeds it up, or turns it into the next aisle.",
      sourcePage: 5, sourceSection: "2.1 What is a force?",
    },
    {
      name: "Net Force", chapter: 1, objective: 1, level: "core", difficulty: 3,
      summary: "The net force is the overall force after combining all forces acting on an object.",
      definition: "Net force is the vector sum of all the forces acting on an object; balanced forces give zero net force, unbalanced forces give a non-zero net force.",
      formulas: ["F_net = F₁ + F₂ + … (as vectors)"], examples: ["In a tug-of-war, if both teams pull equally the rope doesn't move (balanced). If one team pulls harder, the rope accelerates towards them (unbalanced)."],
      facts: ["Only the net force changes motion.", "Forces in opposite directions subtract."],
      misconceptions: ["If an object is not moving, no forces act on it."],
      prerequisites: ["Force"], related: ["Newton's First Law", "Free-Body Diagrams"], analogy: "Net force is like a group decision: everyone pulls in different directions, and the object follows the combined result.",
      sourcePage: 6, sourceSection: "2.2 Balanced and unbalanced forces",
    },
    {
      name: "Inertia", chapter: 1, objective: 1, level: "core", difficulty: 2,
      summary: "Inertia is an object's tendency to keep doing what it is already doing.",
      definition: "Inertia is the tendency of an object to resist changes in its state of motion; objects with more mass have more inertia.",
      formulas: [], examples: ["When a bus brakes suddenly, passengers lurch forward because their bodies tend to keep moving."],
      facts: ["Inertia depends on mass.", "Seatbelts exist because of inertia."],
      misconceptions: ["Inertia is a force that pushes objects."],
      prerequisites: ["Mass"], related: ["Newton's First Law"], analogy: "Inertia is like laziness in objects: a resting object 'wants' to keep resting, and a moving object 'wants' to keep moving.",
      sourcePage: 7, sourceSection: "2.3 Inertia",
    },
    {
      name: "Newton's First Law", chapter: 1, objective: 1, level: "core", difficulty: 2,
      summary: "An object stays at rest or keeps moving at constant velocity unless a net force acts on it.",
      definition: "Newton's first law states that an object remains at rest, or moves in a straight line at constant speed, unless acted on by a non-zero net force.",
      formulas: ["If F_net = 0, then a = 0"], examples: ["A hockey puck on smooth ice glides a long way because very little friction acts on it."],
      facts: ["Also called the law of inertia.", "Moving objects stop in daily life because of friction and air resistance — not because force 'runs out'."],
      misconceptions: ["Moving objects naturally slow down and stop on their own."],
      prerequisites: ["Inertia", "Net Force"], related: ["Newton's Second Law"], analogy: "A marble rolling on a perfectly smooth, endless floor would roll forever — nothing would tell it to stop.",
      sourcePage: 8, sourceSection: "2.4 Newton's first law",
    },
    {
      name: "Newton's Second Law", chapter: 1, objective: 2, level: "core", difficulty: 3,
      summary: "Acceleration equals net force divided by mass: F = ma.",
      definition: "Newton's second law states that the acceleration of an object is directly proportional to the net force on it and inversely proportional to its mass: F = m × a.",
      formulas: ["F = m × a", "a = F / m"], examples: ["Pushing an empty trolley and a full trolley with the same force: the empty one accelerates more because it has less mass.", "A 2 kg ball pushed with a net force of 10 N accelerates at 5 m/s²."],
      facts: ["Double the force → double the acceleration.", "Double the mass → half the acceleration.", "Acceleration is in the direction of the net force."],
      misconceptions: ["Heavier objects always accelerate faster.", "Force and mass mean the same thing, so F = ma just renames mass."],
      prerequisites: ["Force", "Mass", "Acceleration", "Net Force"], related: ["Newton's Third Law", "Weight and Mass"], analogy: "Pushing a bicycle versus pushing a car: the same push gets the bicycle moving quickly but barely moves the car.",
      sourcePage: 9, sourceSection: "2.5 Newton's second law",
    },
    {
      name: "Newton's Third Law", chapter: 1, objective: 1, level: "core", difficulty: 3,
      summary: "For every action there is an equal and opposite reaction.",
      definition: "Newton's third law states that when one object exerts a force on a second object, the second exerts an equal and opposite force on the first.",
      formulas: ["F(A on B) = −F(B on A)"], examples: ["When you jump off a boat, you push the boat backward and the boat pushes you forward.", "A rocket pushes gas down; the gas pushes the rocket up."],
      facts: ["Action and reaction act on different objects, so they don't cancel.", "Forces always come in pairs."],
      misconceptions: ["Action and reaction forces cancel each other out.", "The bigger object pushes harder."],
      prerequisites: ["Force"], related: ["Momentum"], analogy: "Pushing against a wall while wearing roller skates: you push the wall, and the wall pushes you back across the room.",
      sourcePage: 10, sourceSection: "2.6 Newton's third law",
    },
    {
      name: "Weight and Mass", chapter: 2, objective: 3, level: "application", difficulty: 2,
      summary: "Weight is the gravitational force on a mass: W = mg.",
      definition: "Weight is the force of gravity acting on an object's mass, W = m × g; it is measured in newtons, while mass is measured in kilograms.",
      formulas: ["W = m × g", "g ≈ 9.8 m/s² on Earth"], examples: ["A 60 kg student weighs about 588 N on Earth but only about 98 N on the Moon — their mass is still 60 kg."],
      facts: ["Weight changes with gravity; mass doesn't."],
      misconceptions: ["Mass and weight are the same thing."],
      prerequisites: ["Mass", "Newton's Second Law"], related: ["Free-Body Diagrams"], analogy: "Mass is the amount of rice in the bag; weight is how hard the Earth tugs on that bag.",
      sourcePage: 11, sourceSection: "3.1 Weight",
    },
    {
      name: "Friction", chapter: 2, objective: 3, level: "application", difficulty: 2,
      summary: "Friction is a force that opposes sliding between surfaces.",
      definition: "Friction is a contact force that opposes the relative motion (or attempted motion) of two surfaces in contact.",
      formulas: ["f ≤ μN"], examples: ["Shoes grip the ground because of friction; on a wet floor there is less friction so you slip."],
      facts: ["Friction acts opposite to the direction of motion.", "Rough surfaces usually produce more friction."],
      misconceptions: ["Friction is always bad and should be eliminated."],
      prerequisites: ["Force", "Net Force"], related: ["Newton's First Law"], analogy: "Friction is like the grip of a rubber sole on a dry floor versus socks on a polished floor.",
      sourcePage: 12, sourceSection: "3.2 Friction",
    },
    {
      name: "Free-Body Diagrams", chapter: 2, objective: 3, level: "application", difficulty: 3,
      summary: "A free-body diagram shows every force acting on one object as arrows.",
      definition: "A free-body diagram is a sketch of a single object with arrows representing every force acting on it, drawn to show direction and relative size.",
      formulas: [], examples: ["A book resting on a table: weight arrow down, normal force arrow up, equal in length."],
      facts: ["Draw only forces acting ON the object.", "Use arrow length to show relative size."],
      misconceptions: ["You should draw the forces the object exerts on other things."],
      prerequisites: ["Net Force", "Weight and Mass"], related: ["Newton's Second Law"], analogy: "It's like an X-ray of forces: you strip away the scene and see only the pushes and pulls on one object.",
      sourcePage: 13, sourceSection: "3.3 Free-body diagrams",
    },
    {
      name: "Momentum", chapter: 2, objective: 3, level: "advanced", difficulty: 4,
      summary: "Momentum is mass in motion: p = mv.",
      definition: "Momentum is the product of an object's mass and velocity (p = m × v); a net force changes momentum over time.",
      formulas: ["p = m × v", "F = Δp / Δt"], examples: ["A slow truck can have more momentum than a fast bicycle because its mass is much larger."],
      facts: ["In a closed system, total momentum is conserved.", "Airbags increase the stopping time, reducing force."],
      misconceptions: ["Only fast objects have a lot of momentum."],
      prerequisites: ["Velocity", "Mass", "Newton's Second Law"], related: ["Newton's Third Law"], analogy: "Momentum is how hard something is to stop — a rolling boulder versus a rolling football.",
      sourcePage: 14, sourceSection: "3.4 Momentum",
    },
  ],
};

/** Sample page text (the "document") so grounded chat and citations work. */
export function samplePages() {
  const pages: { page: number; text: string }[] = [];
  for (const c of SAMPLE_MODEL.concepts) {
    pages.push({
      page: c.sourcePage ?? 1,
      text: [
        c.sourceSection ?? c.name,
        c.definition,
        c.summary,
        ...c.facts,
        ...c.formulas.map((f) => `Key relation: ${f}`),
        ...c.examples.map((e) => `Example: ${e}`),
        ...c.misconceptions.map((m) => `Common misconception: "${m}" — this is incorrect.`),
      ].join("\n"),
    });
  }
  return pages;
}

/** Hand-authored Tamil representations for the hero demo concept (works with no AI key). */
export const CURATED_TRANSLATIONS: Record<string, Record<string, Record<string, LessonContent>>> = {
  Force: {
    ta: {
      standard: {
        title: "விசை (Force)",
        teacherIntro: "அடிப்படையிலிருந்து தொடங்குவோம். விசை என்றால் என்ன என்று புரிந்துகொள்வோம்.",
        sections: [
          { heading: "விசை என்றால் என்ன?", body: "விசை என்பது ஒரு பொருளின் மீது செலுத்தப்படும் தள்ளுதல் அல்லது இழுத்தல் ஆகும். இது இரண்டு பொருட்களுக்கு இடையிலான தொடர்பால் உருவாகிறது.", kind: "explain" },
          { heading: "விசை என்ன செய்யும்?", body: "விசை ஒரு பொருளின் வேகத்தை மாற்றலாம், அதன் திசையை மாற்றலாம், அல்லது அதன் வடிவத்தை மாற்றலாம்.", kind: "why" },
          { heading: "அளவும் திசையும்", body: "விசை ஒரு வெக்டர் (vector) அளவு — அதற்கு அளவும் திசையும் உண்டு. அலகு: நியூட்டன் (N). 1 N = 1 kg·m/s².", kind: "formula" },
          { heading: "எடுத்துக்காட்டு", body: "கால்பந்தை உதைப்பது, கதவைத் திறக்க இழுப்பது, பூமி ஆப்பிளைக் கீழே இழுப்பது — இவை அனைத்தும் விசைகள்.", kind: "example" },
        ],
        visual: { kind: "flow", nodes: ["பொருள் (Object)", "விசை (Force)", "முடுக்கம் (Acceleration)", "இயக்க மாற்றம்"], caption: "விசை செலுத்தப்பட்டால் பொருளின் இயக்கம் மாறுகிறது." },
        check: {
          question: "பின்வருவனவற்றில் விசையை சிறப்பாக விவரிப்பது எது?",
          options: [
            "ஒரு பொருளில் உள்ள பருப்பொருளின் அளவு",
            "ஒரு பொருளின் இயக்கத்தை மாற்றக்கூடிய தள்ளுதல் அல்லது இழுத்தல்",
            "ஒரு பொருள் நகரும் வேகம் மட்டும்",
            "ஒரு பொருள் இருக்கும் இடம்",
          ],
          answer: 1,
          explanation: "விசை என்பது தள்ளுதல் அல்லது இழுத்தல். பருப்பொருளின் அளவு என்பது நிறை (mass) — அது விசை அல்ல.",
          misconception: "விசையும் நிறையும் ஒன்றே என்று நினைப்பது.",
        },
        summary: "விசை = தள்ளுதல் அல்லது இழுத்தல்; இது இயக்கத்தை மாற்றுகிறது; அலகு நியூட்டன்.",
        objective: "நியூட்டனின் மூன்று இயக்க விதிகளைப் புரிந்துகொள்ளுதல்",
        source: { chapter: "Force and Newton's Laws", section: "2.1 What is a force?", page: 5 },
      },
      analogy: {
        title: "விசை — ஒரு அன்றாட உவமை",
        teacherIntro: "பரவாயில்லை! இதை அன்றாட வாழ்க்கையில் இருந்து ஒரு உதாரணத்துடன் பார்ப்போம்.",
        sections: [
          { heading: "ஷாப்பிங் வண்டியை நினைத்துப் பாருங்கள்", body: "சூப்பர் மார்க்கெட்டில் ஒரு ஷாப்பிங் வண்டியைத் தள்ளுவதாக கற்பனை செய்யுங்கள். நீங்கள் கொடுக்கும் தள்ளுதல் தான் விசை.", kind: "analogy" },
          { heading: "தள்ளினால் என்ன நடக்கும்?", body: "நீங்கள் தள்ளும்போது வண்டி நகரத் தொடங்குகிறது. பலமாகத் தள்ளினால் வேகமாக நகரும். பக்கவாட்டில் தள்ளினால் திசை மாறும்.", kind: "explain" },
          { heading: "உவமையை பாடத்துடன் இணைப்போம்", body: "உங்கள் தள்ளுதல் = விசை. வண்டியின் வேக மாற்றம் = முடுக்கம். வண்டியில் உள்ள பொருட்கள் = நிறை. விசை இயக்கத்தை மாற்றுகிறது.", kind: "explain" },
        ],
        visual: { kind: "flow", nodes: ["உங்கள் தள்ளுதல்", "விசை", "வண்டி நகர்கிறது", "வேகம் / திசை மாறுகிறது"], caption: "ஷாப்பிங் வண்டி: தள்ளுதல் → இயக்க மாற்றம்." },
        check: {
          question: "ஷாப்பிங் வண்டி உவமையில், 'விசை' எதைக் குறிக்கிறது?",
          options: ["வண்டியில் உள்ள பொருட்கள்", "நீங்கள் கொடுக்கும் தள்ளுதல்", "வண்டியின் நிறம்", "சூப்பர் மார்க்கெட்டின் அளவு"],
          answer: 1,
          explanation: "உங்கள் தள்ளுதல் தான் விசை. வண்டியில் உள்ள பொருட்கள் நிறையை (mass) குறிக்கின்றன.",
          misconception: "விசையும் நிறையும் ஒன்றே என்று நினைப்பது.",
        },
        summary: "தள்ளுதல் அல்லது இழுத்தல் = விசை; அது இயக்கத்தை மாற்றுகிறது.",
        objective: "நியூட்டனின் மூன்று இயக்க விதிகளைப் புரிந்துகொள்ளுதல்",
        source: { chapter: "Force and Newton's Laws", section: "2.1 What is a force?", page: 5 },
      },
    },
  },
};
