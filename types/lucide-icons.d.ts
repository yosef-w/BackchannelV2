// Deep per-icon imports (see components/ui/icons.ts) have no .d.ts next to
// them — lucide only ships types for its barrels. This wildcard declaration
// types every icon file as a LucideIcon so props (size/color/strokeWidth/
// fill) stay fully checked at the call sites.
declare module "lucide-react-native/dist/esm/icons/*" {
  const icon: import("lucide-react-native").LucideIcon;
  export default icon;
}
