// Central icon module — the ONLY place lucide icons enter the bundle.
//
// Why: `import { X } from "lucide-react-native"` hits the package barrel,
// which re-exports all ~1,667 icons; Metro doesn't tree-shake, so every
// screen-level barrel import shipped the entire catalog (we use ~65). Deep
// per-icon imports keep the module graph and the production bundle to just
// what's used. An eslint no-restricted-imports rule enforces that new icons
// get added here instead of via the barrel.
//
// Adding an icon: find its FILE (not its display name) in
// node_modules/lucide-react-native/dist/esm/lucide-react-native.mjs — alias
// names don't match filenames (e.g. CheckCircle lives in
// icons/circle-check-big.js) — and add an export line below.
// Lucide 1.x ships types for every icons/* subpath, so no shim is needed.

export { default as AlertCircle } from "lucide-react-native/icons/circle-alert";
export { default as AlertTriangle } from "lucide-react-native/icons/triangle-alert";
export { default as ArrowLeft } from "lucide-react-native/icons/arrow-left";
export { default as ArrowRight } from "lucide-react-native/icons/arrow-right";
export { default as Award } from "lucide-react-native/icons/award";
export { default as Bell } from "lucide-react-native/icons/bell";
export { default as BellRing } from "lucide-react-native/icons/bell-ring";
export { default as Briefcase } from "lucide-react-native/icons/briefcase";
export { default as Building2 } from "lucide-react-native/icons/building-complex";
export { default as Calendar } from "lucide-react-native/icons/calendar";
export { default as Camera } from "lucide-react-native/icons/camera";
export { default as Check } from "lucide-react-native/icons/check";
export { default as CheckCircle } from "lucide-react-native/icons/circle-check-big";
export { default as CheckCircle2 } from "lucide-react-native/icons/circle-check";
export { default as ChevronDown } from "lucide-react-native/icons/chevron-down";
export { default as ChevronLeft } from "lucide-react-native/icons/chevron-left";
export { default as ChevronRight } from "lucide-react-native/icons/chevron-right";
export { default as ChevronUp } from "lucide-react-native/icons/chevron-up";
export { default as ClipboardCheck } from "lucide-react-native/icons/clipboard-check";
export { default as Clock } from "lucide-react-native/icons/clock";
export { default as Coffee } from "lucide-react-native/icons/coffee";
export { default as Copy } from "lucide-react-native/icons/copy";
export { default as DollarSign } from "lucide-react-native/icons/dollar-sign";
export { default as Edit } from "lucide-react-native/icons/square-pen";
export { default as ExternalLink } from "lucide-react-native/icons/external-link";
export { default as Eye } from "lucide-react-native/icons/eye";
export { default as EyeOff } from "lucide-react-native/icons/eye-off";
export { default as FileText } from "lucide-react-native/icons/file-text";
export { default as Flag } from "lucide-react-native/icons/flag";
export { default as Globe } from "lucide-react-native/icons/globe";
export { default as GraduationCap } from "lucide-react-native/icons/graduation-cap";
export { default as HandHeart } from "lucide-react-native/icons/hand-heart";
export { default as Handshake } from "lucide-react-native/icons/handshake";
export { default as Heart } from "lucide-react-native/icons/heart";
export { default as Home } from "lucide-react-native/icons/house";
export { default as Image } from "lucide-react-native/icons/image";
export { default as ImageIcon } from "lucide-react-native/icons/image";
export { default as Info } from "lucide-react-native/icons/info";
export { default as Link2 } from "lucide-react-native/icons/link-2";
export { default as List } from "lucide-react-native/icons/list";
export { default as Lock } from "lucide-react-native/icons/lock";
export { default as LogOut } from "lucide-react-native/icons/log-out";
export { default as Mail } from "lucide-react-native/icons/mail";
export { default as MapPin } from "lucide-react-native/icons/map-pin";
export { default as MessageCircle } from "lucide-react-native/icons/message-circle";
export { default as MessageSquareQuote } from "lucide-react-native/icons/message-square-quote";
export { default as MoreHorizontal } from "lucide-react-native/icons/ellipsis";
export { default as Network } from "lucide-react-native/icons/network";
export { default as Pencil } from "lucide-react-native/icons/pencil";
export { default as Plus } from "lucide-react-native/icons/plus";
export { default as RefreshCcw } from "lucide-react-native/icons/refresh-ccw";
export { default as RefreshCw } from "lucide-react-native/icons/refresh-cw";
export { default as Rocket } from "lucide-react-native/icons/rocket";
export { default as Search } from "lucide-react-native/icons/search";
export { default as Send } from "lucide-react-native/icons/send";
export { default as ShieldCheck } from "lucide-react-native/icons/shield-check";
export { default as Star } from "lucide-react-native/icons/star";
export { default as Target } from "lucide-react-native/icons/target";
export { default as ThumbsDown } from "lucide-react-native/icons/thumbs-down";
export { default as Trash2 } from "lucide-react-native/icons/trash";
export { default as TrendingUp } from "lucide-react-native/icons/trending-up";
export { default as Upload } from "lucide-react-native/icons/upload";
export { default as User } from "lucide-react-native/icons/user";
export { default as UserCheck } from "lucide-react-native/icons/user-check";
export { default as UserPlus } from "lucide-react-native/icons/user-plus";
export { default as Users } from "lucide-react-native/icons/users";
export { default as X } from "lucide-react-native/icons/x";
export { default as XCircle } from "lucide-react-native/icons/circle-x";
export { default as Zap } from "lucide-react-native/icons/zap";
export { default as WifiOff } from "lucide-react-native/icons/wifi-off";
