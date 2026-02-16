
# Modernizare Site RezervaArena

## Obiectiv
Aspect mai modern, tranzitii subtile si rapide, performanta imbunatatita.

## Modificari planificate

### 1. Header - aspect modern cu efect glassmorphism imbunatatit
- Adaugare `border-b border-border/50` si shadow subtil la scroll (via CSS)
- Tranzitie animata la meniul mobil (slide-down cu opacity)
- Butoanele din header vor avea tranzitii hover mai fluide

### 2. HeroSection - animatii de intrare
- Titlul si subtitlul vor aparea cu animatie `fade-in` staggered (h1 intai, apoi p, apoi butoanele)
- Butoanele hero vor avea un efect hover mai vizibil cu `translate-y` subtil
- Gradient overlay mai modern cu un blur mai pronuntat pe imagine

### 3. SearchSection - card mai modern
- SearchSection card-ul este gol (are doar structura fara continut vizibil) - va fi verificat si reparat daca e cazul
- Adaugare border subtil animat la focus pe inputuri

### 4. SportsSection - card-uri cu animatii la scroll
- Adaugare animatie `fade-in` la fiecare card cand apare in viewport (folosind Intersection Observer)
- Stagger effect: fiecare card apare cu un delay mic (50ms per card)
- Hover pe card: shadow mai pronuntat + translateY(-4px) tranzitie rapida (200ms)
- Badge-uri sport cu tranzitie de culoare la hover

### 5. FeaturesSection - animatii subtile
- Iconitele din carduri vor avea o animatie de rotatie subtila la hover (10deg)
- Cardurile vor avea fade-in la scroll cu stagger
- Gradient pe icon circle mai vizibil

### 6. Footer - tranzitii pe link-uri
- Link-urile vor avea underline animat (de la stanga la dreapta) la hover
- Separator line cu gradient subtil

### 7. Tranzitii globale si performanta (index.css + tailwind.config.ts)
- Adaugare keyframe `fade-in-up` cu variante staggered
- Adaugare clasa utilitara `.animate-on-scroll` cu Intersection Observer
- Adaugare `scroll-behavior: smooth` pe html
- Optimizare `transition-smooth` la 200ms pentru un feel mai rapid
- Adaugare `will-change: transform` pe elementele animate pentru GPU acceleration

### 8. Componenta noua: useScrollAnimation hook
- Hook simplu bazat pe Intersection Observer care adauga clasa de animatie cand elementul intra in viewport
- Reutilizabil in orice sectiune

## Detalii tehnice

**Fisiere modificate:**
- `src/index.css` - stiluri globale noi, scroll smooth, clase animate-on-scroll
- `tailwind.config.ts` - keyframes noi (fade-in-up, slide-up), animatii noi
- `src/hooks/useScrollAnimation.ts` - hook NOU pentru Intersection Observer
- `src/components/HeroSection.tsx` - animatii de intrare staggered
- `src/components/SportsSection.tsx` - carduri cu animatie la scroll
- `src/components/FeaturesSection.tsx` - carduri cu animatie la scroll
- `src/components/Header.tsx` - meniu mobil animat, shadow la scroll
- `src/components/Footer.tsx` - link-uri cu underline animat

**Principii:**
- Toate tranzitiile vor fi max 300ms (rapide si subtile)
- Se foloseste `transform` si `opacity` pentru performanta GPU
- `prefers-reduced-motion` va fi respectat (dezactivare animatii pentru utilizatori care prefera)
- Nu se adauga dependinte noi - totul se face cu CSS si React hooks native
