---
name: Intra Group Interface
colors:
  surface: '#0f131e'
  surface-dim: '#0f131e'
  surface-bright: '#353945'
  surface-container-lowest: '#0a0e18'
  surface-container-low: '#171b26'
  surface-container: '#1b1f2a'
  surface-container-high: '#252a35'
  surface-container-highest: '#303540'
  on-surface: '#dfe2f1'
  on-surface-variant: '#bbc9cd'
  inverse-surface: '#dfe2f1'
  inverse-on-surface: '#2c303c'
  outline: '#859397'
  outline-variant: '#3c494c'
  surface-tint: '#27d9f7'
  primary: '#c2f3ff'
  on-primary: '#00363f'
  primary-container: '#38e1ff'
  on-primary-container: '#00616f'
  inverse-primary: '#006878'
  secondary: '#98cbff'
  on-secondary: '#003354'
  secondary-container: '#059af0'
  on-secondary-container: '#002e4d'
  tertiary: '#eee7ff'
  on-tertiary: '#31009a'
  tertiary-container: '#d2c7ff'
  on-tertiary-container: '#5933db'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#a6eeff'
  primary-fixed-dim: '#27d9f7'
  on-primary-fixed: '#001f25'
  on-primary-fixed-variant: '#004e5b'
  secondary-fixed: '#cfe5ff'
  secondary-fixed-dim: '#98cbff'
  on-secondary-fixed: '#001d33'
  on-secondary-fixed-variant: '#004a77'
  tertiary-fixed: '#e6deff'
  tertiary-fixed-dim: '#cabeff'
  on-tertiary-fixed: '#1c0062'
  on-tertiary-fixed-variant: '#4816cb'
  background: '#0f131e'
  on-background: '#dfe2f1'
  surface-variant: '#303540'
typography:
  display-lg:
    fontFamily: Sora
    fontSize: 32px
    fontWeight: '800'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Sora
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  title-sm:
    fontFamily: Sora
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-md:
    fontFamily: Sora
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Sora
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.1em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  container-padding: 20px
  stack-gap-lg: 24px
  stack-gap-md: 16px
  stack-gap-sm: 8px
  grid-margin: 16px
  safe-area-bottom: 34px
---

## Brand & Style
The design system for this Telegram Mini App is rooted in a **Dark Futuristic** aesthetic, specifically tailored for high-performance utility within the INTRA GROUP ecosystem. The style leverages **Glassmorphism** and **Cyberpunk-lite** influences to create a sense of depth and advanced technology.

The interface prioritizes high-density information through clear visual hierarchies and neon-tinted accents. The emotional goal is to make the user feel like they are operating a high-end command console—precise, responsive, and premium. The background is a deliberate deep navy to maintain better legibility and reduce eye strain compared to pure black, while vibrant cyan and blue gradients provide the "energy" of the system.

## Colors
The palette is centered around the contrast between a deep, "infinite" space navy and luminous gas-neon accents.

- **Background**: Use `#060a14` for the base canvas.
- **Primary Gradient**: The Cyan-to-Blue transition is used for primary actions, progress bars, and critical status indicators.
- **Secondary Accent**: Purple is reserved for secondary highlights, special features, or tiered rewards to provide visual variety without breaking the cold tech theme.
- **Glass System**: Surfaces use a 15% opacity white or primary tint with a `backdrop-blur-md` (12px-16px). Borders are essential for defining edges in dark mode; use the subtle Cyan-tinted border to simulate light refracting through glass edges.

## Typography
The system uses **Sora** for its bold, geometric structure which feels inherently modern and "tech-first." For technical readouts, IDs, and small data labels, **JetBrains Mono** is introduced to reinforce the developer-centric, futuristic aesthetic.

- **Headlines**: Always bold. Use tight letter-spacing for large displays to create a high-impact "header" look.
- **Labels**: Small labels and data points should use the Monospaced font in uppercase to simulate a terminal or HUD readout.
- **Legibility**: Ensure body text stays at `#dbe9ff` (Light Blue-White) to maintain contrast against the deep navy backgrounds.

## Layout & Spacing
Designed specifically for a **390px wide** mobile viewport (iPhone 13/14/15 standard).

- **Grid**: Use a 12-column fluid grid internally, but prioritize a single-column vertical stack for the main UI. 
- **Margins**: Use a consistent 20px side margin for primary containers.
- **Rhythm**: Spacing follows an 8px base unit. Component internal padding should be generous (16px or 20px) to complement the large corner radii.
- **Telegram Integration**: Account for the top header bar (Telegram UI) and ensure critical actions are not placed in the bottom 34px to avoid interference with the home indicator.

## Elevation & Depth
In this design system, depth is communicated through **transparency and glow** rather than traditional grey shadows.

- **Layer 0**: Base background (`#060a14`).
- **Layer 1**: Glassmorphic cards. These should have a subtle inner glow (1px stroke) and a `backdrop-filter: blur(12px)`.
- **Layer 2**: Floating elements or active buttons. These use **Soft Glow Shadows**—a drop shadow with the same color as the element (e.g., Cyan) at 30-50% opacity with a high blur radius (20px+).
- **Interactive States**: When a card is pressed, increase the border opacity from 15% to 40% and intensify the backdrop blur.

## Shapes
The shape language is characterized by **Large Rounded Corners**, which softens the "aggressive" nature of dark futuristic themes, making the app feel more approachable and like a modern OS.

- **Cards**: Use 24px for all main container cards to create a distinctive, friendly frame.
- **Buttons**: Use 16px to maintain a punchy, clickable look that fits within the card containers.
- **Icons**: Icons should be housed in circular or 12px rounded glass boxes.

## Components
- **Primary Button**: Filled with the Cyan-Blue gradient. Text is bold and dark (`#060a14`) for maximum contrast. Apply a cyan outer glow shadow.
- **Glass Card**: Background `rgba(255, 255, 255, 0.05)`, 24px radius, 1px border `rgba(56, 225, 255, 0.15)`.
- **Input Fields**: Darker than the card background (`rgba(0,0,0,0.2)`), 12px radius, with a focus state that turns the border into a solid Cyan glow.
- **Chips/Badges**: Use the Purple accent for status badges or categories, typically with a low-opacity purple fill and solid purple text.
- **Progress Bars**: Track should be semi-transparent navy; the filler should be the primary Cyan gradient with a small glow "head" at the leading edge.
- **Lists**: Items separated by a thin, 5% opacity cyan line, or individual mini-glass cards with 12px spacing.