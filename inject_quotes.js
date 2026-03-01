const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');

const quotes = [
    {
        cat: "breath",
        icon: "🫁",
        tool: "Coherent Breathing",
        en: "I do coherent breathing for 10 minutes a day. I also use 4-7-8 breathing during the day to help balance my nervous system.",
        es: "Hago respiración coherente durante 10 minutos al día. También utilizo la respiración 4-7-8 durante el día para ayudar a equilibrar mi sistema nervioso."
    },
    {
        cat: "senses",
        icon: "✋",
        tool: "Textures Touch",
        en: "Touching moss, leaves or the water of the river.",
        es: "Tocar el musgo, las hojas o el agua del río."
    },
    {
        cat: "pacing",
        icon: "⏱️",
        tool: "Slow Down",
        en: "Step by step.",
        es: "Paso a paso."
    },
    {
        cat: "thoughts",
        icon: "💭",
        tool: "Mindful Visualisation",
        en: "I think of my worst FND symptoms as passing clouds, they'll dissipate.",
        es: "Pienso en mis peores síntomas de FND como nubes pasajeras, se disiparán."
    },
    {
        cat: "movement",
        icon: "🤸",
        tool: "Stretching",
        en: "I feel more energized and stronger within my body after doing this practice.",
        es: "Me siento con más energía y más fuerte físicamente después de hacer esta práctica."
    },
    {
        cat: "arts",
        icon: "🎨",
        tool: "Creative Arts",
        en: "I use creativity in many ways to support my healing. I have found that this is the number one way to bring light into this journey.",
        es": "Utilizo la creatividad de muchas maneras para apoyar mi curación.He descubierto que esta es la mejor manera de aportar luz a este viaje."
    },
    {
        cat: "social",
        icon: "🤝",
        tool: "Support Groups",
        en: "Having seizures or tremors can be very isolating. Talking to people going through similar things can really help with coping.",
        es: "Tener convulsiones o temblores puede ser muy aislante. Hablar con personas que están pasando por situaciones similares puede ayudar mucho a sobrellevarlo."
    },
    {
        cat: "nutrition",
        icon: "🍵",
        tool: "Gut-Friendly Focus",
        en: "Following the Mediterranean diet as fully as possible helps with my gut, stomach and overall well-being.",
        es: "Seguir la dieta mediterránea lo más fielmente posible me ayuda con mi intestino, mi estómago y mi bienestar general."
    },
    {
        cat: "nature",
        icon: "🌿",
        tool: "Blue-Space Pause",
        en: "Go to the beach or see the sea and hear the waves.",
        es: "Ir a la playa o ver el mar y escuchar las olas."
    },
    {
        cat: "compassion",
        icon: "💛",
        tool: "Self-Compassion Letter",
        en: "I am learning to love myself and speak to myself as I do to people I love.",
        es: "Estoy aprendiendo a quererme y a hablarme como lo hago con las personas que quiero."
    }
];

quotes.forEach((q, i) => {
    let catTitle = q.cat.charAt(0).toUpperCase() + q.cat.slice(1);

    // 1. HTML Insertion
    if (i < 9) {
        let nextCat = quotes[i + 1].cat.toUpperCase();
        let searchStr = `<!-- ${nextCat} (5) -->`;
        let insertion = `<div class="story-card" data-category="${q.cat}">
                        <div class="quote-mark">"</div>
                        <p class="story-text">${q.en}</p>
                        <div class="story-footer">
                            <div class="quote-tool-label"><span class="qt-icon">${q.icon}</span> ${q.tool} · <em>${catTitle}</em></div>
                            <button class="heart-btn" onclick="toggleHeart(this)" aria-label="Like this quote">♡ <span class="count">80</span></button>
                        </div>
                    </div>
                    `;
        html = html.replace(searchStr, insertion + searchStr);
    } else {
        let searchStr = '</div>\n\n                <div class="stories-fade-overlay" id="storiesFade"></div>';
        let insertion = `<div class="story-card" data-category="${q.cat}">
                        <div class="quote-mark">"</div>
                        <p class="story-text">${q.en}</p>
                        <div class="story-footer">
                            <div class="quote-tool-label"><span class="qt-icon">${q.icon}</span> ${q.tool} · <em>${catTitle}</em></div>
                            <button class="heart-btn" onclick="toggleHeart(this)" aria-label="Like this quote">♡ <span class="count">80</span></button>
                        </div>
                    </div>
                `;
        html = html.replace(searchStr, insertion + searchStr);
    }

    // 2. JS Array Insertion
    if (i < 9) {
        let nextCat = quotes[i + 1].cat.toUpperCase();
        let searchStr = `// ${nextCat} (5)`;
        let insertion = `,\n            '${q.es}'\n            `;
        html = html.replace(searchStr, insertion + searchStr);
    } else {
        html = html.replace(
            /(amor propio siempre ganan\.')(\n\s+\];)/g,
            `$1,\n            '${q.es}'$2`
        );
    }
});

fs.writeFileSync('index.html', html, 'utf8');
console.log('Updates completed successfully.');
