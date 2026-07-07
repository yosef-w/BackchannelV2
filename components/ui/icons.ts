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
// node_modules/lucide-react-native/dist/esm/lucide-react-native.js — alias
// names don't match filenames (e.g. CheckCircle lives in
// icons/circle-check-big.js) — and add an export line below.
// Types come from types/lucide-icons.d.ts (wildcard module declaration).

export { default as AlertCircle } from "lucide-react-native/dist/esm/icons/circle-alert.js";
export { default as AlertTriangle } from "lucide-react-native/dist/esm/icons/triangle-alert.js";
export { default as ArrowLeft } from "lucide-react-native/dist/esm/icons/arrow-left.js";
export { default as ArrowRight } from "lucide-react-native/dist/esm/icons/arrow-right.js";
export { default as Award } from "lucide-react-native/dist/esm/icons/award.js";
export { default as Bell } from "lucide-react-native/dist/esm/icons/bell.js";
export { default as BellRing } from "lucide-react-native/dist/esm/icons/bell-ring.js";
export { default as Briefcase } from "lucide-react-native/dist/esm/icons/briefcase.js";
export { default as Building2 } from "lucide-react-native/dist/esm/icons/building-2.js";
export { default as Calendar } from "lucide-react-native/dist/esm/icons/calendar.js";
export { default as Camera } from "lucide-react-native/dist/esm/icons/camera.js";
export { default as Check } from "lucide-react-native/dist/esm/icons/check.js";
export { default as CheckCircle } from "lucide-react-native/dist/esm/icons/circle-check-big.js";
export { default as CheckCircle2 } from "lucide-react-native/dist/esm/icons/circle-check.js";
export { default as ChevronDown } from "lucide-react-native/dist/esm/icons/chevron-down.js";
export { default as ChevronLeft } from "lucide-react-native/dist/esm/icons/chevron-left.js";
export { default as ChevronRight } from "lucide-react-native/dist/esm/icons/chevron-right.js";
export { default as ChevronUp } from "lucide-react-native/dist/esm/icons/chevron-up.js";
export { default as ClipboardCheck } from "lucide-react-native/dist/esm/icons/clipboard-check.js";
export { default as Clock } from "lucide-react-native/dist/esm/icons/clock.js";
export { default as Coffee } from "lucide-react-native/dist/esm/icons/coffee.js";
export { default as DollarSign } from "lucide-react-native/dist/esm/icons/dollar-sign.js";
export { default as Edit } from "lucide-react-native/dist/esm/icons/square-pen.js";
export { default as Eye } from "lucide-react-native/dist/esm/icons/eye.js";
export { default as EyeOff } from "lucide-react-native/dist/esm/icons/eye-off.js";
export { default as FileText } from "lucide-react-native/dist/esm/icons/file-text.js";
export { default as Flag } from "lucide-react-native/dist/esm/icons/flag.js";
export { default as Globe } from "lucide-react-native/dist/esm/icons/globe.js";
export { default as GraduationCap } from "lucide-react-native/dist/esm/icons/graduation-cap.js";
export { default as HandHeart } from "lucide-react-native/dist/esm/icons/hand-heart.js";
export { default as Handshake } from "lucide-react-native/dist/esm/icons/handshake.js";
export { default as Heart } from "lucide-react-native/dist/esm/icons/heart.js";
export { default as Home } from "lucide-react-native/dist/esm/icons/house.js";
export { default as Image } from "lucide-react-native/dist/esm/icons/image.js";
export { default as ImageIcon } from "lucide-react-native/dist/esm/icons/image.js";
export { default as Info } from "lucide-react-native/dist/esm/icons/info.js";
export { default as Link2 } from "lucide-react-native/dist/esm/icons/link-2.js";
export { default as Lock } from "lucide-react-native/dist/esm/icons/lock.js";
export { default as LogOut } from "lucide-react-native/dist/esm/icons/log-out.js";
export { default as Mail } from "lucide-react-native/dist/esm/icons/mail.js";
export { default as MapPin } from "lucide-react-native/dist/esm/icons/map-pin.js";
export { default as MessageCircle } from "lucide-react-native/dist/esm/icons/message-circle.js";
export { default as MessageSquareQuote } from "lucide-react-native/dist/esm/icons/message-square-quote.js";
export { default as MoreHorizontal } from "lucide-react-native/dist/esm/icons/ellipsis.js";
export { default as Network } from "lucide-react-native/dist/esm/icons/network.js";
export { default as Pencil } from "lucide-react-native/dist/esm/icons/pencil.js";
export { default as Plus } from "lucide-react-native/dist/esm/icons/plus.js";
export { default as RefreshCcw } from "lucide-react-native/dist/esm/icons/refresh-ccw.js";
export { default as RefreshCw } from "lucide-react-native/dist/esm/icons/refresh-cw.js";
export { default as Rocket } from "lucide-react-native/dist/esm/icons/rocket.js";
export { default as Search } from "lucide-react-native/dist/esm/icons/search.js";
export { default as Send } from "lucide-react-native/dist/esm/icons/send.js";
export { default as ShieldCheck } from "lucide-react-native/dist/esm/icons/shield-check.js";
export { default as Star } from "lucide-react-native/dist/esm/icons/star.js";
export { default as Target } from "lucide-react-native/dist/esm/icons/target.js";
export { default as ThumbsDown } from "lucide-react-native/dist/esm/icons/thumbs-down.js";
export { default as Trash2 } from "lucide-react-native/dist/esm/icons/trash-2.js";
export { default as TrendingUp } from "lucide-react-native/dist/esm/icons/trending-up.js";
export { default as Upload } from "lucide-react-native/dist/esm/icons/upload.js";
export { default as User } from "lucide-react-native/dist/esm/icons/user.js";
export { default as UserCheck } from "lucide-react-native/dist/esm/icons/user-check.js";
export { default as UserPlus } from "lucide-react-native/dist/esm/icons/user-plus.js";
export { default as Users } from "lucide-react-native/dist/esm/icons/users.js";
export { default as X } from "lucide-react-native/dist/esm/icons/x.js";
export { default as XCircle } from "lucide-react-native/dist/esm/icons/circle-x.js";
export { default as Zap } from "lucide-react-native/dist/esm/icons/zap.js";
