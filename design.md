# Bench Boss design system

## Current direction
User explicitly redirected the full redesign on Nov 3, 2026 to resemble FantasyPros and other fantasy sites. This supersedes Rim.

## References inspected
FantasyPros public My Playbook + NHL rankings: blue filled actions (computed rgb(7,105,222)), Poppins headings, white workspace, dense ranked data. Yahoo Fantasy Hockey: white panels, gray separators, clear setup and player lists. ESPN Fantasy Hockey: pale gray canvas, white content cards, dark masthead. Bench Boss retains its own name/logo; no competitor assets or text copied.

## Tokens
app/tokens.css authoritative: bg-paper = pale cool gray canvas; bg-paper-2 = white panel; bg-paper-3 = soft gray inset; text-ink = dark navy; text-ink-2 = slate; text-muted = accessible gray; border-rule = light gray; text-accent/bg-accent = saturated blue; text-accent-ink = white; success green/error red; --color-brand-navy and --color-on-brand for masthead. Poppins headings at 600/700, existing Inter body. 6px card radii, 4px controls. Subtle defined borders, no big shadows/gradients.

## Components
Shared bb-page/header/panel/toolbar/button/button-secondary/field/table/empty/stat-strip retained and restyled globally by root. Use semantic Tailwind tokens. Page headings 28–32px, section headings 18px bold, tables 13–14px, labels 12–14px. White cards are intentional user reference, not optional extra decoration. No nested cards, glow, tracked uppercase labels, or decorative reveal motion.

## Layout
Full-width navy masthead above white sidebar and pale gray content. Sidebar about 220px. Capped 1440px workspace. Dashboard has main setup/roster column and narrower player-research rail. Primary action blue, links blue; active nav blue on pale blue. Mobile bottom navigation, active item kept in view. Tables prioritize Player + PTS, horizontal overflow hint and sticky identity. No remote mock metrics.

## Controls / behavior
Preserve forms, ids, handlers, routes, data wiring, and initial user edits. 44px hit target, instant focus ring. Existing loading/error/success states. Reduced motion. No API writes during visual tests.
