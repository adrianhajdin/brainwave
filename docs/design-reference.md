# Biotech Company Website Design Specification

A biotech website must project scientific credibility while embracing modern design that signals innovation. This specification synthesizes patterns from leading biotech sites (Sensei Bio, Cambrian Bio) with best-in-class animation (GSAP) and component architecture (shadcn/ui) to create an actionable blueprint for a website targeting investors and researchers.

---

## Design system foundation

### Brand-aligned color palette

The color system balances scientific authority with innovative warmth. All colors use CSS variables for consistent theming and dark mode support.

```css
:root {
  /* Primary: Scientific Blue - conveys trust, innovation, expertise */
  --primary: oklch(0.45 0.15 220);
  --primary-foreground: oklch(0.99 0 0);
  
  /* Secondary: Life Science Teal - growth, health, vitality */
  --secondary: oklch(0.55 0.12 180);
  --secondary-foreground: oklch(0.99 0 0);
  
  /* Accent: Innovation Purple - breakthrough, premium */
  --accent: oklch(0.58 0.16 280);
  --accent-foreground: oklch(0.99 0 0);
  
  /* Success: Clinical Green - positive outcomes */
  --success: oklch(0.65 0.18 145);
  --success-foreground: oklch(0.15 0 0);
  
  /* Neutrals: Slate base for scientific sophistication */
  --background: oklch(0.995 0.002 250);
  --foreground: oklch(0.15 0.015 250);
  --muted: oklch(0.96 0.005 250);
  --muted-foreground: oklch(0.45 0.01 250);
  
  /* Surface colors */
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.15 0.015 250);
  --border: oklch(0.90 0.005 250);
  --input: oklch(0.92 0.005 250);
  
  /* Interactive states */
  --ring: oklch(0.45 0.15 220);
  --radius: 0.5rem;
}

.dark {
  --background: oklch(0.12 0.015 250);
  --foreground: oklch(0.96 0.005 250);
  --card: oklch(0.16 0.015 250);
  --border: oklch(0.25 0.01 250);
  --muted: oklch(0.20 0.01 250);
}
```

### Typography system

Typography establishes hierarchy and scientific credibility. Use a clean sans-serif that renders well at all sizes.

| Element | Font | Size | Weight | Line Height | Letter Spacing |
|---------|------|------|--------|-------------|----------------|
| Display (hero) | Inter/Geist | 64-80px | 600 | 1.1 | -0.02em |
| H1 | Inter/Geist | 48-56px | 600 | 1.15 | -0.015em |
| H2 | Inter/Geist | 36-40px | 600 | 1.2 | -0.01em |
| H3 | Inter/Geist | 28-32px | 500 | 1.25 | 0 |
| H4 | Inter/Geist | 20-24px | 500 | 1.3 | 0 |
| Body Large | Inter/Geist | 18px | 400 | 1.7 | 0.01em |
| Body | Inter/Geist | 16px | 400 | 1.6 | 0.01em |
| Small | Inter/Geist | 14px | 400 | 1.5 | 0.02em |
| Caption | Inter/Geist | 12px | 500 | 1.4 | 0.04em |

**Implementation**: Use Tailwind's typography plugin with custom extensions:

```javascript
// tailwind.config.js
theme: {
  extend: {
    fontFamily: {
      sans: ['Inter', 'system-ui', 'sans-serif'],
    },
    fontSize: {
      'display': ['clamp(3rem, 5vw, 5rem)', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
      'hero-sub': ['clamp(1.125rem, 2vw, 1.5rem)', { lineHeight: '1.5' }],
    }
  }
}
```

### Spacing and layout grid

Consistent spacing creates visual rhythm and professional polish. Base unit: **4px**.

| Token | Value | Usage |
|-------|-------|-------|
| `space-xs` | 4px | Icon padding, tight gaps |
| `space-sm` | 8px | Button padding, inline gaps |
| `space-md` | 16px | Component internal padding |
| `space-lg` | 24px | Card padding, section gaps |
| `space-xl` | 32px | Component spacing |
| `space-2xl` | 48px | Section padding mobile |
| `space-3xl` | 64px | Section padding tablet |
| `space-4xl` | 96px | Section padding desktop |
| `space-5xl` | 128px | Hero section padding |

**Container widths**:
- Max content width: **1280px**
- Max text width: **720px** (optimal reading)
- Sidebar width: **280px**

**Grid system**: 12-column grid with **24px** gutters (desktop), **16px** (mobile)

---

## Animation strategy with GSAP

### Core animation principles

Animations must enhance credibility rather than distract. Follow these guidelines for professional biotech presentation:

- **Subtlety over spectacle**: Movements of **30-50px** maximum for translations
- **Consistent timing**: **0.6-0.8 seconds** for most content reveals
- **Professional easing**: `power2.out` as default, `power3.out` for hero sections
- **Performance first**: Animate only `transform` and `opacity` properties
- **Accessibility required**: Always respect `prefers-reduced-motion`

### GSAP configuration

```javascript
// lib/gsap.js
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(ScrollTrigger, SplitText);

// Global defaults for professional biotech feel
gsap.defaults({
  duration: 0.8,
  ease: 'power2.out'
});

ScrollTrigger.defaults({
  toggleActions: 'play none none none',
  start: 'top 85%'
});

export { gsap, ScrollTrigger, SplitText };
```

### Animation patterns library

**Fade-up reveal** (primary entrance animation):
```javascript
function fadeUpReveal(selector, options = {}) {
  return gsap.from(selector, {
    opacity: 0,
    y: 40,
    duration: options.duration || 0.8,
    stagger: options.stagger || 0.1,
    ease: 'power2.out',
    scrollTrigger: {
      trigger: options.trigger || selector,
      start: options.start || 'top 85%',
      toggleActions: 'play none none none'
    }
  });
}
```

**Staggered cards** (for team, pipeline, news):
```javascript
function staggerCards(selector) {
  ScrollTrigger.batch(selector, {
    onEnter: (elements) => gsap.from(elements, {
      opacity: 0,
      y: 30,
      scale: 0.98,
      stagger: 0.08,
      duration: 0.6,
      ease: 'power2.out'
    }),
    start: 'top 90%'
  });
}
```

**Hero text reveal** (using SplitText):
```javascript
function heroTextReveal(selector) {
  document.fonts.ready.then(() => {
    SplitText.create(selector, {
      type: 'lines',
      linesClass: 'line-wrapper',
      mask: 'lines',
      onSplit(self) {
        return gsap.from(self.lines, {
          yPercent: 100,
          opacity: 0,
          stagger: 0.12,
          duration: 1,
          ease: 'power3.out'
        });
      }
    });
  });
}
```

**Counter animation** (for statistics):
```javascript
function animateCounter(element, endValue, suffix = '') {
  const counter = { value: 0 };
  return gsap.to(counter, {
    value: endValue,
    duration: 2,
    ease: 'power2.out',
    snap: { value: 1 },
    scrollTrigger: {
      trigger: element,
      start: 'top 80%',
      toggleActions: 'play none none none'
    },
    onUpdate: () => {
      element.textContent = Math.round(counter.value).toLocaleString() + suffix;
    }
  });
}
```

**Parallax backgrounds**:
```javascript
function createParallax(element, speed = -20) {
  return gsap.to(element, {
    yPercent: speed,
    ease: 'none',
    scrollTrigger: {
      trigger: element.parentElement,
      start: 'top bottom',
      end: 'bottom top',
      scrub: 1
    }
  });
}
```

### React/Next.js integration pattern

```javascript
'use client';
import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap, ScrollTrigger } from '@/lib/gsap';

export function AnimatedSection({ children }) {
  const containerRef = useRef(null);
  
  useGSAP(() => {
    const cards = containerRef.current.querySelectorAll('.animate-card');
    
    gsap.from(cards, {
      opacity: 0,
      y: 40,
      stagger: 0.1,
      scrollTrigger: {
        trigger: containerRef.current,
        start: 'top 80%'
      }
    });
  }, { scope: containerRef });
  
  return <section ref={containerRef}>{children}</section>;
}
```

### Accessibility implementation

```javascript
// Always wrap animations in reduced-motion check
const mm = gsap.matchMedia();

mm.add({
  noMotionPref: '(prefers-reduced-motion: no-preference)',
  reduceMotion: '(prefers-reduced-motion: reduce)'
}, (context) => {
  const { noMotionPref, reduceMotion } = context.conditions;
  
  gsap.from('.content', {
    opacity: reduceMotion ? 1 : 0,
    y: reduceMotion ? 0 : 40,
    duration: reduceMotion ? 0 : 0.8
  });
});
```

---

## Component specifications

### Navigation header

**Behavior**: Fixed position, transparent on hero, solid white with shadow on scroll.

```jsx
<header className="fixed top-0 w-full z-50 transition-all duration-300">
  <nav className="container mx-auto flex items-center justify-between h-20 px-6">
    <Logo className="h-10 w-auto" />
    
    <NavigationMenu className="hidden lg:flex">
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuLink href="/about">About</NavigationMenuLink>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuTrigger>Innovation</NavigationMenuTrigger>
          <NavigationMenuContent>
            <NavigationMenuLink href="/pipeline">Pipeline</NavigationMenuLink>
            <NavigationMenuLink href="/research">Research</NavigationMenuLink>
            <NavigationMenuLink href="/technology">Technology</NavigationMenuLink>
          </NavigationMenuContent>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink href="/newsroom">Newsroom</NavigationMenuLink>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink href="/investors">Investors</NavigationMenuLink>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
    
    <Button variant="default">Contact Us</Button>
    
    {/* Mobile menu trigger */}
    <Sheet>
      <SheetTrigger className="lg:hidden">
        <MenuIcon />
      </SheetTrigger>
      <SheetContent side="right">
        {/* Mobile navigation */}
      </SheetContent>
    </Sheet>
  </nav>
</header>
```

**Scroll behavior animation**:
```javascript
useGSAP(() => {
  ScrollTrigger.create({
    start: 'top -80',
    onUpdate: (self) => {
      const header = document.querySelector('header');
      if (self.direction === 1 && self.scroll() > 100) {
        header.classList.add('bg-white/95', 'shadow-sm', 'backdrop-blur-md');
        header.classList.remove('bg-transparent');
      }
    }
  });
});
```

### Button system

Four primary variants optimized for biotech contexts:

```jsx
// Primary CTA - for main actions
<Button variant="default" size="lg">
  Request Meeting
</Button>

// Secondary - for supporting actions  
<Button variant="outline" size="default">
  Learn More
</Button>

// Ghost - for navigation/minimal contexts
<Button variant="ghost" size="sm">
  View All News
</Button>

// Investor-specific CTA
<Button variant="default" className="bg-emerald-600 hover:bg-emerald-700">
  Investor Portal
</Button>
```

**Button specifications**:
| Size | Height | Padding | Font Size | Border Radius |
|------|--------|---------|-----------|---------------|
| sm | 36px | 12px 16px | 14px | 6px |
| default | 44px | 16px 24px | 15px | 8px |
| lg | 52px | 20px 32px | 16px | 8px |

### Card components

**Team member card**:
```jsx
<Card className="group overflow-hidden">
  <div className="aspect-[4/5] overflow-hidden">
    <img 
      src={member.photo} 
      alt={member.name}
      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
    />
  </div>
  <CardHeader>
    <CardTitle className="text-lg">{member.name}</CardTitle>
    <CardDescription>{member.title}</CardDescription>
  </CardHeader>
  <CardContent className="pt-0">
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="link" className="p-0 h-auto">Read Bio →</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{member.name}</DialogTitle>
          <DialogDescription>{member.title}</DialogDescription>
        </DialogHeader>
        <div className="prose prose-sm">{member.bio}</div>
      </DialogContent>
    </Dialog>
  </CardContent>
</Card>
```

**Pipeline program card**:
```jsx
<Card className="relative overflow-hidden border-l-4 border-l-primary">
  <CardHeader>
    <div className="flex items-center justify-between">
      <Badge variant="outline">{program.phase}</Badge>
      <Badge variant={program.status === 'active' ? 'default' : 'secondary'}>
        {program.status}
      </Badge>
    </div>
    <CardTitle className="text-xl">{program.name}</CardTitle>
    <CardDescription>{program.target}</CardDescription>
  </CardHeader>
  <CardContent>
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">{program.indication}</p>
      <Progress value={program.progressPercent} className="h-2" />
    </div>
  </CardContent>
  <CardFooter>
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="details" className="border-0">
        <AccordionTrigger className="text-sm">Learn More</AccordionTrigger>
        <AccordionContent>{program.details}</AccordionContent>
      </AccordionItem>
    </Accordion>
  </CardFooter>
</Card>
```

**News card**:
```jsx
<Card className="group cursor-pointer hover:shadow-md transition-shadow">
  <div className="aspect-video overflow-hidden">
    <img 
      src={article.image} 
      alt=""
      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-102"
    />
  </div>
  <CardHeader>
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Badge variant="secondary">{article.category}</Badge>
      <span>{article.date}</span>
    </div>
    <CardTitle className="text-lg group-hover:text-primary transition-colors">
      {article.title}
    </CardTitle>
  </CardHeader>
  <CardContent>
    <p className="text-muted-foreground line-clamp-2">{article.excerpt}</p>
  </CardContent>
</Card>
```

---

## Page section specifications

### Home page

**Hero section** (full viewport height):

```jsx
<section className="relative min-h-screen flex items-center justify-center overflow-hidden">
  {/* Background video with fallback */}
  <video 
    autoPlay 
    muted 
    loop 
    playsInline
    className="absolute inset-0 w-full h-full object-cover"
    poster="/images/hero-fallback.jpg"
  >
    <source src="/videos/hero-cells.mp4" type="video/mp4" />
  </video>
  
  {/* Overlay gradient */}
  <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/70 to-transparent" />
  
  {/* Content */}
  <div className="container relative z-10 px-6 py-32">
    <div className="max-w-2xl space-y-6">
      <Badge variant="outline" className="animate-fade-in">
        Pioneering Therapeutic Innovation
      </Badge>
      
      <h1 className="text-display font-semibold text-foreground hero-title">
        Transforming the Future of Medicine
      </h1>
      
      <p className="text-hero-sub text-muted-foreground max-w-xl">
        We're developing breakthrough therapies that address critical unmet 
        medical needs through innovative science and rigorous research.
      </p>
      
      <div className="flex flex-wrap gap-4 pt-4">
        <Button size="lg">Our Approach</Button>
        <Button size="lg" variant="outline">View Pipeline</Button>
      </div>
    </div>
  </div>
  
  {/* Scroll indicator */}
  <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
    <ChevronDownIcon className="w-6 h-6 text-muted-foreground" />
  </div>
</section>
```

**Hero animation sequence**:
```javascript
useGSAP(() => {
  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
  
  tl.from('.hero-title', { 
    opacity: 0, 
    y: 60, 
    duration: 1 
  })
  .from('.hero-title + p', { 
    opacity: 0, 
    y: 40, 
    duration: 0.8 
  }, '-=0.5')
  .from('.hero-title ~ div button', { 
    opacity: 0, 
    y: 30, 
    stagger: 0.1, 
    duration: 0.6 
  }, '-=0.4');
});
```

**Mission/value proposition section**:
```jsx
<section className="py-24 lg:py-32 bg-muted/30">
  <div className="container px-6">
    <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
      <div className="space-y-6">
        <h2 className="text-3xl lg:text-4xl font-semibold">
          Science-Driven Innovation
        </h2>
        <p className="text-lg text-muted-foreground leading-relaxed">
          Our approach combines cutting-edge research with deep biological 
          insights to develop therapies that make a meaningful difference 
          in patients' lives.
        </p>
        <ul className="space-y-4">
          {values.map((value) => (
            <li key={value.title} className="flex items-start gap-3">
              <CheckCircleIcon className="w-6 h-6 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-medium">{value.title}</h4>
                <p className="text-sm text-muted-foreground">{value.description}</p>
              </div>
            </li>
          ))}
        </ul>
        <Button variant="outline">Learn About Our Approach →</Button>
      </div>
      
      <div className="relative">
        <img 
          src="/images/lab-research.jpg" 
          alt="Scientists collaborating in laboratory"
          className="rounded-lg shadow-2xl"
        />
        {/* Stats overlay */}
        <div className="absolute -bottom-6 -left-6 bg-card p-6 rounded-lg shadow-xl">
          <div className="text-3xl font-bold text-primary counter" data-value="15">0</div>
          <div className="text-sm text-muted-foreground">Programs in Development</div>
        </div>
      </div>
    </div>
  </div>
</section>
```

**Pipeline preview section**:
```jsx
<section className="py-24 lg:py-32">
  <div className="container px-6">
    <div className="text-center max-w-2xl mx-auto mb-16">
      <h2 className="text-3xl lg:text-4xl font-semibold mb-4">
        Our Pipeline
      </h2>
      <p className="text-lg text-muted-foreground">
        A diverse portfolio of therapeutic candidates across multiple 
        stages of development.
      </p>
    </div>
    
    <Tabs defaultValue="all" className="w-full">
      <TabsList className="grid w-full max-w-md mx-auto grid-cols-4 mb-8">
        <TabsTrigger value="all">All</TabsTrigger>
        <TabsTrigger value="discovery">Discovery</TabsTrigger>
        <TabsTrigger value="preclinical">Preclinical</TabsTrigger>
        <TabsTrigger value="clinical">Clinical</TabsTrigger>
      </TabsList>
      
      <TabsContent value="all">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {programs.map((program) => (
            <PipelineCard key={program.id} program={program} />
          ))}
        </div>
      </TabsContent>
    </Tabs>
    
    <div className="text-center mt-12">
      <Button size="lg">View Full Pipeline</Button>
    </div>
  </div>
</section>
```

### About page

**Leadership team section**:
```jsx
<section className="py-24 lg:py-32">
  <div className="container px-6">
    <div className="text-center max-w-2xl mx-auto mb-16">
      <h2 className="text-3xl lg:text-4xl font-semibold mb-4">
        Leadership Team
      </h2>
      <p className="text-lg text-muted-foreground">
        Experienced leaders driving innovation with integrity.
      </p>
    </div>
    
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
      {leadership.map((member, index) => (
        <TeamMemberCard 
          key={member.id} 
          member={member} 
          className="animate-card"
          style={{ '--stagger-delay': `${index * 0.1}s` }}
        />
      ))}
    </div>
  </div>
</section>
```

**Timeline/history section**:
```jsx
<section className="py-24 lg:py-32 bg-muted/30">
  <div className="container px-6">
    <h2 className="text-3xl lg:text-4xl font-semibold text-center mb-16">
      Our Journey
    </h2>
    
    <div className="relative max-w-4xl mx-auto">
      {/* Vertical line */}
      <div className="absolute left-8 lg:left-1/2 top-0 bottom-0 w-0.5 bg-border" />
      
      {milestones.map((milestone, index) => (
        <div 
          key={milestone.year}
          className={cn(
            "relative grid lg:grid-cols-2 gap-8 mb-12 animate-card",
            index % 2 === 0 ? 'lg:text-right' : 'lg:flex-row-reverse'
          )}
        >
          <div className={cn("lg:pr-12", index % 2 !== 0 && "lg:col-start-2 lg:pl-12 lg:pr-0")}>
            <div className="text-primary font-bold text-xl mb-2">{milestone.year}</div>
            <h3 className="text-xl font-semibold mb-2">{milestone.title}</h3>
            <p className="text-muted-foreground">{milestone.description}</p>
          </div>
          
          {/* Timeline dot */}
          <div className="absolute left-8 lg:left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-primary border-4 border-background" />
        </div>
      ))}
    </div>
  </div>
</section>
```

### Innovation/pipeline page

**Interactive pipeline table**:
```jsx
<section className="py-24">
  <div className="container px-6">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[200px]">Program</TableHead>
          <TableHead>Target</TableHead>
          <TableHead>Indication</TableHead>
          <TableHead className="text-center">Discovery</TableHead>
          <TableHead className="text-center">Preclinical</TableHead>
          <TableHead className="text-center">Phase 1</TableHead>
          <TableHead className="text-center">Phase 2</TableHead>
          <TableHead className="text-center">Phase 3</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {programs.map((program) => (
          <TableRow key={program.id} className="group">
            <TableCell className="font-medium">
              <Accordion type="single" collapsible>
                <AccordionItem value="details" className="border-0">
                  <AccordionTrigger className="hover:no-underline py-0">
                    {program.name}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground">
                    {program.description}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </TableCell>
            <TableCell>{program.target}</TableCell>
            <TableCell>{program.indication}</TableCell>
            {/* Phase progress cells with visual indicators */}
            {['discovery', 'preclinical', 'phase1', 'phase2', 'phase3'].map((phase) => (
              <TableCell key={phase} className="text-center">
                <div className={cn(
                  "w-full h-2 rounded-full",
                  program.phase >= phaseMap[phase] ? "bg-primary" : "bg-muted"
                )} />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
</section>
```

### Newsroom page

**News grid with filtering**:
```jsx
<section className="py-24">
  <div className="container px-6">
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-12">
      <h1 className="text-4xl font-semibold">Newsroom</h1>
      
      <div className="flex items-center gap-4">
        <Select defaultValue="all">
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All News</SelectItem>
            <SelectItem value="press">Press Releases</SelectItem>
            <SelectItem value="publications">Publications</SelectItem>
            <SelectItem value="events">Events</SelectItem>
          </SelectContent>
        </Select>
        
        <Input placeholder="Search news..." className="w-[200px]" />
      </div>
    </div>
    
    {/* Featured article */}
    <Card className="mb-12 overflow-hidden">
      <div className="grid lg:grid-cols-2">
        <div className="aspect-video lg:aspect-auto">
          <img src={featuredArticle.image} alt="" className="w-full h-full object-cover" />
        </div>
        <div className="p-8 lg:p-12 flex flex-col justify-center">
          <Badge className="w-fit mb-4">Featured</Badge>
          <h2 className="text-2xl lg:text-3xl font-semibold mb-4">{featuredArticle.title}</h2>
          <p className="text-muted-foreground mb-6">{featuredArticle.excerpt}</p>
          <Button variant="outline" className="w-fit">Read More</Button>
        </div>
      </div>
    </Card>
    
    {/* News grid */}
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
      {articles.map((article) => (
        <NewsCard key={article.id} article={article} />
      ))}
    </div>
    
    <Pagination className="mt-12" />
  </div>
</section>
```

### Investors page

**Key metrics dashboard**:
```jsx
<section className="py-16 bg-muted/30">
  <div className="container px-6">
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {metrics.map((metric) => (
        <Card key={metric.label} className="text-center p-6">
          <div 
            className="text-4xl font-bold text-primary mb-2 counter"
            data-value={metric.value}
            data-suffix={metric.suffix}
          >
            0
          </div>
          <div className="text-sm text-muted-foreground">{metric.label}</div>
        </Card>
      ))}
    </div>
  </div>
</section>
```

**Stock information widget**:
```jsx
<Card className="p-6">
  <CardHeader className="p-0 pb-4">
    <div className="flex items-center justify-between">
      <div>
        <CardTitle className="text-lg">NASDAQ: BTCH</CardTitle>
        <CardDescription>Stock Quote (15-min delay)</CardDescription>
      </div>
      <Badge variant="outline">Live</Badge>
    </div>
  </CardHeader>
  <CardContent className="p-0">
    <div className="text-4xl font-bold mb-4">${stockData.price}</div>
    <div className={cn(
      "text-sm font-medium",
      stockData.change >= 0 ? "text-success" : "text-destructive"
    )}>
      {stockData.change >= 0 ? '+' : ''}{stockData.change} ({stockData.changePercent}%)
    </div>
    <Separator className="my-4" />
    <div className="grid grid-cols-2 gap-4 text-sm">
      <div>
        <span className="text-muted-foreground">Day High:</span>
        <span className="ml-2 font-medium">${stockData.dayHigh}</span>
      </div>
      <div>
        <span className="text-muted-foreground">Day Low:</span>
        <span className="ml-2 font-medium">${stockData.dayLow}</span>
      </div>
      <div>
        <span className="text-muted-foreground">52W High:</span>
        <span className="ml-2 font-medium">${stockData.yearHigh}</span>
      </div>
      <div>
        <span className="text-muted-foreground">52W Low:</span>
        <span className="ml-2 font-medium">${stockData.yearLow}</span>
      </div>
    </div>
  </CardContent>
</Card>
```

**SEC filings table**:
```jsx
<Card>
  <CardHeader>
    <CardTitle>SEC Filings</CardTitle>
  </CardHeader>
  <CardContent>
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Form Type</TableHead>
          <TableHead>Description</TableHead>
          <TableHead className="text-right">Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filings.map((filing) => (
          <TableRow key={filing.id}>
            <TableCell>{filing.date}</TableCell>
            <TableCell>
              <Badge variant="outline">{filing.formType}</Badge>
            </TableCell>
            <TableCell>{filing.description}</TableCell>
            <TableCell className="text-right">
              <Button variant="ghost" size="sm" asChild>
                <a href={filing.url} target="_blank" rel="noopener">
                  <DownloadIcon className="w-4 h-4 mr-2" />
                  PDF
                </a>
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </CardContent>
</Card>
```

### Contact page

**Dual-track contact form** (scientists/investors):
```jsx
<section className="py-24">
  <div className="container px-6 max-w-4xl">
    <div className="text-center mb-12">
      <h1 className="text-4xl font-semibold mb-4">Get in Touch</h1>
      <p className="text-lg text-muted-foreground">
        We'd love to hear from you. Select your interest below.
      </p>
    </div>
    
    <Tabs defaultValue="general" className="w-full">
      <TabsList className="grid w-full grid-cols-3 mb-8">
        <TabsTrigger value="general">General Inquiry</TabsTrigger>
        <TabsTrigger value="scientific">Scientific Collaboration</TabsTrigger>
        <TabsTrigger value="investor">Investor Relations</TabsTrigger>
      </TabsList>
      
      <TabsContent value="general">
        <Card>
          <CardContent className="pt-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Jane" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Doe" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="jane@company.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="message"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Message</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="How can we help you?"
                          className="min-h-[120px]"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <Button type="submit" size="lg" className="w-full sm:w-auto">
                  Send Message
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  </div>
</section>
```

### Footer

```jsx
<footer className="bg-foreground text-background py-16">
  <div className="container px-6">
    <div className="grid lg:grid-cols-5 gap-12">
      {/* Brand column */}
      <div className="lg:col-span-2">
        <Logo variant="light" className="h-10 mb-6" />
        <p className="text-muted-foreground/80 mb-6 max-w-sm">
          Pioneering therapeutic innovation to transform patient lives 
          through breakthrough science.
        </p>
        <div className="flex gap-4">
          <Button variant="ghost" size="icon" asChild>
            <a href="https://linkedin.com" aria-label="LinkedIn">
              <LinkedInIcon className="w-5 h-5" />
            </a>
          </Button>
          <Button variant="ghost" size="icon" asChild>
            <a href="https://twitter.com" aria-label="Twitter">
              <TwitterIcon className="w-5 h-5" />
            </a>
          </Button>
        </div>
      </div>
      
      {/* Navigation columns */}
      <div>
        <h4 className="font-semibold mb-4">Company</h4>
        <ul className="space-y-3">
          <li><a href="/about" className="text-muted-foreground/80 hover:text-background">About Us</a></li>
          <li><a href="/leadership" className="text-muted-foreground/80 hover:text-background">Leadership</a></li>
          <li><a href="/careers" className="text-muted-foreground/80 hover:text-background">Careers</a></li>
          <li><a href="/contact" className="text-muted-foreground/80 hover:text-background">Contact</a></li>
        </ul>
      </div>
      
      <div>
        <h4 className="font-semibold mb-4">Science</h4>
        <ul className="space-y-3">
          <li><a href="/pipeline" className="text-muted-foreground/80 hover:text-background">Pipeline</a></li>
          <li><a href="/research" className="text-muted-foreground/80 hover:text-background">Research</a></li>
          <li><a href="/publications" className="text-muted-foreground/80 hover:text-background">Publications</a></li>
        </ul>
      </div>
      
      <div>
        <h4 className="font-semibold mb-4">Investors</h4>
        <ul className="space-y-3">
          <li><a href="/investors" className="text-muted-foreground/80 hover:text-background">Overview</a></li>
          <li><a href="/investors/sec-filings" className="text-muted-foreground/80 hover:text-background">SEC Filings</a></li>
          <li><a href="/investors/governance" className="text-muted-foreground/80 hover:text-background">Governance</a></li>
          <li><a href="/newsroom" className="text-muted-foreground/80 hover:text-background">News</a></li>
        </ul>
      </div>
    </div>
    
    <Separator className="my-8 bg-muted-foreground/20" />
    
    <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-muted-foreground/60">
      <p>© 2026 Biotech Company. All rights reserved.</p>
      <div className="flex gap-6">
        <a href="/privacy" className="hover:text-background">Privacy Policy</a>
        <a href="/terms" className="hover:text-background">Terms of Use</a>
        <a href="/accessibility" className="hover:text-background">Accessibility</a>
      </div>
    </div>
  </div>
</footer>
```

---

## Technical implementation guidance

### Project setup

```bash
# Create Next.js project
npx create-next-app@latest biotech-website --typescript --tailwind --app

# Initialize shadcn/ui
npx shadcn@latest init

# Add required components
npx shadcn@latest add button card dialog accordion tabs table \
  navigation-menu form input textarea select badge avatar \
  separator sheet progress toast

# Install GSAP
npm install gsap @gsap/react
```

### Directory structure

```
├── app/
│   ├── (marketing)/
│   │   ├── page.tsx              # Home
│   │   ├── about/page.tsx
│   │   ├── innovation/page.tsx
│   │   ├── newsroom/page.tsx
│   │   ├── investors/page.tsx
│   │   └── contact/page.tsx
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── ui/                       # shadcn components
│   ├── sections/                 # Page sections
│   │   ├── hero.tsx
│   │   ├── pipeline-table.tsx
│   │   ├── team-grid.tsx
│   │   └── contact-form.tsx
│   ├── cards/
│   │   ├── team-card.tsx
│   │   ├── news-card.tsx
│   │   └── pipeline-card.tsx
│   └── layout/
│       ├── header.tsx
│       └── footer.tsx
├── lib/
│   ├── gsap.ts                   # GSAP configuration
│   ├── utils.ts                  # Utility functions
│   └── animations.ts             # Reusable animations
└── hooks/
    └── use-scroll-animation.ts
```

### Performance optimization checklist

- [ ] **Images**: Use Next.js Image component with `priority` for above-fold, WebP format
- [ ] **Fonts**: Self-host Inter/Geist, use `font-display: swap`
- [ ] **Videos**: Lazy load below-fold videos, provide poster images
- [ ] **Animations**: Use `will-change` sparingly, animate only transforms/opacity
- [ ] **Code splitting**: Dynamic imports for heavy components (charts, maps)
- [ ] **Caching**: Configure appropriate cache headers for static assets

### SEO and accessibility requirements

- [ ] Semantic HTML structure (proper heading hierarchy)
- [ ] `aria-label` on all icon-only buttons
- [ ] Skip navigation link at page top
- [ ] Focus visible styles on all interactive elements
- [ ] `prefers-reduced-motion` media query support
- [ ] Alt text on all images (empty for decorative)
- [ ] Form labels properly associated with inputs
- [ ] Color contrast ratio ≥ 4.5:1 for body text
- [ ] Meta descriptions and Open Graph tags on all pages

---

## Biotech industry best practices

### Credibility signals throughout

- **Partnership logos**: Display pharmaceutical partners and collaborators prominently
- **Publication citations**: Link to peer-reviewed research with proper academic formatting
- **Leadership credentials**: Include degrees, institutional affiliations, board positions
- **Regulatory milestones**: Highlight FDA designations, IND approvals, trial progress
- **Investor relations compliance**: SEC filing links, stock information, governance documentation

### Content presentation for dual audiences

**For investors**:
- Clear pipeline visualization with clinical phases
- Financial metrics and stock performance
- Governance and compliance information
- Upcoming catalysts and timelines
- Risk factors and forward-looking statement disclaimers

**For researchers/scientists**:
- Mechanism of action explanations
- Scientific publications and data
- Technology platform details
- Collaboration opportunities
- Career/research openings

### Trust-building design patterns

- **Consistent visual language**: Same illustration style, color usage across all pages
- **Generous whitespace**: Conveys stability and clarity
- **Professional photography**: Warm, human-focused lab imagery
- **Restrained animation**: Subtle motion that doesn't undermine scientific credibility
- **Clear data presentation**: Tables and visualizations for complex information
- **External link warnings**: Modal confirmation when leaving site (regulatory consideration)

### Mobile-first responsive approach

All sections must function flawlessly across devices:
- **Breakpoints**: 640px (sm), 768px (md), 1024px (lg), 1280px (xl)
- **Touch targets**: Minimum 44×44px for all interactive elements
- **Navigation**: Sheet/drawer pattern for mobile, full horizontal nav for desktop
- **Tables**: Horizontal scroll or card-based alternative on mobile
- **Videos**: Static fallback images for bandwidth-constrained users

---

## Conclusion

This specification provides a complete blueprint for building a biotech website that balances innovation with credibility. The combination of **shadcn/ui's accessible component architecture**, **GSAP's professional animation capabilities**, and **design patterns proven by leading biotech companies** creates a foundation for a site that will effectively serve investors, researchers, and potential employees.

Key implementation priorities should be:
1. Establish the design system tokens (colors, typography, spacing) first
2. Build the component library with shadcn/ui as foundation
3. Implement GSAP animations incrementally, starting with hero sections
4. Test accessibility and performance throughout development
5. Validate content presentation with target audience representatives

The result will be a website that projects scientific authority while embracing modern design—exactly what's needed to build trust with sophisticated biotech audiences.