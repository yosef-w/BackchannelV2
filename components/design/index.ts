// Barrel export for the design-system primitives. Screens should import from
// here: `import { Screen, SectionHeader, Card, Pill, Button } from "@/components/design";`
//
// Adding a new primitive? Drop it in components/design/<Name>.tsx and re-export
// it below.

export { Button } from "./Button";
export type { ButtonProps, ButtonSize, ButtonVariant } from "./Button";

export { Card } from "./Card";
export type { CardProps } from "./Card";

export { Divider } from "./Divider";
export type { DividerProps } from "./Divider";

export { HeroBackdrop } from "./HeroBackdrop";
export type { HeroBackdropProps } from "./HeroBackdrop";

export { Input } from "./Input";
export type { InputProps } from "./Input";

export { Pill } from "./Pill";
export type { PillProps, PillTone } from "./Pill";

export { Screen } from "./Screen";
export type { ScreenProps } from "./Screen";

export { SectionHeader } from "./SectionHeader";
export type { SectionHeaderProps } from "./SectionHeader";

export { HStack, Stack, VStack } from "./Stack";
export type { StackProps } from "./Stack";

export { Body, Eyebrow, Meta, Text } from "./Text";
export type { TextProps, TextVariant } from "./Text";
