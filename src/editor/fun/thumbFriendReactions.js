export const REACTIONS = {
  high_ctr: {
    threshold: 80,
    expressions: { hype_coach: 'excited', brutally_honest: 'impressed', chill_creative_director: 'happy', data_nerd: 'happy', the_legend: 'excited' },
    messages: {
      hype_coach:              "YOOO that CTR score is FIRE! 🔥 This thumbnail is gonna PRINT clicks!",
      brutally_honest:         "Okay fine. That's actually a solid score. Don't let it go to your head.",
      chill_creative_director: "Vibe check: passed. That score is looking real nice.",
      data_nerd:               "CTR score exceeds 80th percentile benchmark. Statistical significance: high.",
      the_legend:              "The numbers don't lie. This is the way. 📈",
    },
  },
  low_ctr: {
    threshold: 30,
    expressions: { hype_coach: 'concerned', brutally_honest: 'neutral', chill_creative_director: 'concerned', data_nerd: 'thinking', the_legend: 'neutral' },
    messages: {
      hype_coach:              "Yo we gotta fix this! The score is low — let's pump it up! Add a face and some bolder text!",
      brutally_honest:         "This score is rough. I'd suggest starting over, but I'll help you fix it instead.",
      chill_creative_director: "The score's telling us something. Might be worth listening. More contrast maybe?",
      data_nerd:               "CTR score below 30th percentile. Primary factors: brightness and text coverage.",
      the_legend:              "Even legends have bad days. The comeback starts now.",
    },
  },
  no_face: {
    expressions: { hype_coach: 'thinking', brutally_honest: 'neutral', chill_creative_director: 'thinking', data_nerd: 'thinking', the_legend: 'thinking' },
    messages: {
      hype_coach:              "Where's the face?! Thumbnails with faces get 30% more clicks — add one!",
      brutally_honest:         "No face detected. Studies show faces increase CTR. This is just math.",
      chill_creative_director: "Just a thought — a human face in the corner could really pop this.",
      data_nerd:               "Face detection: negative. Recommend adding portrait for 28% average CTR lift.",
      the_legend:              "The face is the hook. People click on people. It's been true since the beginning.",
    },
  },
};

/**
 * checkReactions(context, personality)
 * context: { ctrScore, hasFace, layerCount }
 * Returns array of triggered reactions { expression, message }
 */
export function checkReactions(context, personality = 'chill_creative_director') {
  const triggered = [];
  if (context.ctrScore >= REACTIONS.high_ctr.threshold) {
    const r = REACTIONS.high_ctr;
    triggered.push({ expression: r.expressions[personality] || 'happy', message: r.messages[personality] });
  } else if (context.ctrScore > 0 && context.ctrScore < REACTIONS.low_ctr.threshold) {
    const r = REACTIONS.low_ctr;
    triggered.push({ expression: r.expressions[personality] || 'concerned', message: r.messages[personality] });
  }
  if (!context.hasFace && context.layerCount > 0) {
    const r = REACTIONS.no_face;
    triggered.push({ expression: r.expressions[personality] || 'thinking', message: r.messages[personality] });
  }
  return triggered;
}
