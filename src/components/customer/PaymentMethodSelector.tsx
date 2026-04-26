"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import {
    CreditCard,
    Building2,
    Smartphone,
    Wallet,
    QrCode,
    Store,
    CheckCircle2,
    Banknote,
} from "lucide-react";
import Image from "next/image";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PaymentMethodId =
    | "vnpay_card"       // Thẻ nội địa ATM / Napas
    | "vnpay_intl"       // Thẻ quốc tế Visa / Mastercard / JCB / UnionPay
    | "vnpay_transfer"   // Chuyển khoản Internet Banking
    | "vnpay_qr"         // VNPay QR (quét mã)
    | "vnpay_wallet"     // Ví VNPay
    | "momo"             // Ví MoMo
    | "zalopay"          // Ví ZaloPay
    | "apple_pay"        // Apple Pay (iOS / macOS only)
    | "counter"          // Thanh toán tại quầy
    | "bank_transfer";   // Chuyển khoản ngân hàng (VietQR)

interface PaymentMethodGroup {
    readonly id: string;
    readonly headingKey: string;
    readonly methods: readonly PaymentMethod[];
}

interface PaymentMethod {
    readonly id: PaymentMethodId;
    readonly labelKey: string;
    readonly descKey: string;
    readonly icon: React.ReactNode;
    readonly logoSlot?: React.ReactNode;
    readonly badge?: string;
    readonly applePlatformOnly?: boolean;
}

interface PaymentMethodSelectorProps {
    selected: PaymentMethodId;
    onChange: (id: PaymentMethodId) => void;
    disabled?: boolean;
    enabledMethods?: string[];
}

// ─── Logo helpers (SVG inline for reliability) ────────────────────────────────

const VisaLogo: React.FC = () => (
    <svg viewBox="0 0 780 500" className="h-5 w-auto" aria-label="Visa">
        <rect width="780" height="500" rx="40" fill="#1A1F71" />
        <text x="390" y="330" textAnchor="middle" fill="white" fontSize="230" fontFamily="Arial" fontWeight="bold" fontStyle="italic">VISA</text>
    </svg>
);

const MastercardLogo: React.FC = () => (
    <svg viewBox="0 0 152 108" className="h-5 w-auto" aria-label="Mastercard">
        <circle cx="52" cy="54" r="52" fill="#EB001B" />
        <circle cx="100" cy="54" r="52" fill="#F79E1B" />
        <path d="M76,21.5A51.9,51.9,0,0,1,100,54,51.9,51.9,0,0,1,76,86.5,51.9,51.9,0,0,1,52,54,51.9,51.9,0,0,1,76,21.5Z" fill="#FF5F00" />
    </svg>
);

const JcbLogo: React.FC = () => (
    <svg viewBox="0 0 60 40" className="h-5 w-auto" aria-label="JCB">
        <rect width="60" height="40" rx="5" fill="#003087" />
        <text x="30" y="27" textAnchor="middle" fill="white" fontSize="14" fontFamily="Arial" fontWeight="bold">JCB</text>
    </svg>
);

const UnionPayLogo: React.FC = () => (
    <svg viewBox="0 0 80 50" className="h-5 w-auto" aria-label="UnionPay">
        <rect width="80" height="50" rx="5" fill="#E21836" />
        <rect x="30" width="50" height="50" rx="5" fill="#00447C" />
        <rect x="20" width="40" height="50" fill="#007B40" />
    </svg>
);

const VNPayLogo: React.FC = () => (
    <svg viewBox="0 0 120 40" className="h-5 w-auto" aria-label="VNPay">
        <rect width="120" height="40" rx="6" fill="#005BAA" />
        <text x="60" y="27" textAnchor="middle" fill="white" fontSize="16" fontFamily="Arial" fontWeight="bold">VNPay</text>
    </svg>
);

const MoMoLogo: React.FC = () => (
    <svg viewBox="0 0 60 60" className="h-5 w-auto" aria-label="MoMo">
        <rect width="60" height="60" rx="12" fill="#AE2070" />
        <text x="30" y="38" textAnchor="middle" fill="white" fontSize="16" fontFamily="Arial" fontWeight="bold">Mo</text>
    </svg>
);

const ZaloPayLogo: React.FC = () => (
    <svg viewBox="0 0 80 40" className="h-5 w-auto" aria-label="ZaloPay">
        <rect width="80" height="40" rx="6" fill="#0068ff" />
        <text x="40" y="26" textAnchor="middle" fill="white" fontSize="13" fontFamily="Arial" fontWeight="bold">ZaloPay</text>
    </svg>
);

// ─── Radio indicator ─────────────────────────────────────────────────────────

interface RadioDotProps {
    selected: boolean;
    color?: string;
}

const RadioDot: React.FC<RadioDotProps> = ({ selected, color = "bg-[#F5C842]" }) => (
    <div
        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-200 ${selected ? "border-[#F5C842]" : "border-gray-200"
            }`}
        aria-hidden
    >
        {selected && <div className={`w-2.5 h-2.5 rounded-full ${color}`} />}
    </div>
);

// ─── Single method card ───────────────────────────────────────────────────────

interface MethodCardProps {
    method: PaymentMethod;
    selected: boolean;
    disabled: boolean;
    onSelect: (id: PaymentMethodId) => void;
}

const MethodCard: React.FC<MethodCardProps> = ({ method, selected, disabled, onSelect }) => {
    const handleClick = useCallback(() => {
        if (!disabled) onSelect(method.id);
    }, [disabled, method.id, onSelect]);

    return (
        <button
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={method.id}
            disabled={disabled}
            onClick={handleClick}
            className={[
                "w-full text-left rounded-2xl border-2 px-4 py-3.5 transition-all duration-200 flex items-center gap-3 group",
                selected
                    ? "border-[#F5C842] bg-gradient-to-r from-amber-50/80 to-yellow-50/40 shadow-sm shadow-amber-100"
                    : "border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm",
                disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
            ].join(" ")}
        >
            {/* Method icon */}
            <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center relative flex-shrink-0 transition-all duration-200 ${selected ? "bg-amber-100" : "bg-gray-50 group-hover:bg-gray-100"
                    }`}
            >
                {method.icon}
            </div>

            {/* Label + logos */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <p className={`text-sm font-semibold leading-tight ${selected ? "text-[#1A1A2E]" : "text-gray-700"}`}>
                        {method.labelKey}
                    </p>
                    {method.badge && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-blue-100 text-blue-600 uppercase tracking-wide">
                            {method.badge}
                        </span>
                    )}
                </div>
                {method.logoSlot && (
                    <div className="flex items-center gap-1.5 mt-1.5 relative">
                        {method.logoSlot}
                    </div>
                )}
                <p className="text-xs text-gray-400 mt-0.5 leading-tight">{method.descKey}</p>
            </div>

            {/* Radio */}
            <RadioDot selected={selected} />
        </button>
    );
};

// ─── Group header ─────────────────────────────────────────────────────────────

const GroupHeading: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-gray-400 px-1 pt-1">
        {children}
    </p>
);

// ─── Main component ───────────────────────────────────────────────────────────

export const PaymentMethodSelector: React.FC<PaymentMethodSelectorProps> = ({
    selected,
    onChange,
    disabled = false,
    enabledMethods,
}) => {
    const t = useTranslations("paymentSelector");

    // Build groups — icons and logos are JSX, labels come from i18n
    const groups: PaymentMethodGroup[] = [
        {
            id: "online",
            headingKey: t("groupOnline"),
            methods: [
                {
                    id: "vnpay_card",
                    labelKey: t("methodCard"),
                    descKey: t("methodCardDesc"),
                    icon: <CreditCard className="h-5 w-5 text-blue-500" />,
                    logoSlot: (
                        <>
                            <VisaLogo />
                            <MastercardLogo />
                            <JcbLogo />
                            <UnionPayLogo />
                        </>
                    ),
                },
                {
                    id: "vnpay_intl",
                    labelKey: t("methodIntl"),
                    descKey: t("methodIntlDesc"),
                    icon: <CreditCard className="h-5 w-5 text-violet-500" />,
                    logoSlot: (
                        <>
                            <VisaLogo />
                            <MastercardLogo />
                        </>
                    ),
                    badge: "3D Secure",
                },
                {
                    id: "vnpay_transfer",
                    labelKey: t("methodQr"),
                    descKey: t("methodQrDesc"),
                    icon: <QrCode className="h-5 w-5 text-emerald-500" />,
                    logoSlot: <VNPayLogo />,
                },
                {
                    id: "apple_pay",
                    labelKey: t("methodApplePay"),
                    descKey: t("methodApplePayDesc"),
                    icon: <Image src="/images/apple.png" alt="Apple Pay" fill className="object-contain" />,
                    badge: "Apple",
                    applePlatformOnly: true,
                },
            ],
        },
        {
            id: "ewallet",
            headingKey: t("groupWallet"),
            methods: [
                {
                    id: "vnpay_wallet",
                    labelKey: t("methodVNPayWallet"),
                    descKey: t("methodVNPayWalletDesc"),
                    icon: <Wallet className="h-5 w-5 text-blue-600" />,
                    logoSlot: <VNPayLogo />,
                },
            ],
        },
        {
            id: "counter",
            headingKey: t("groupCounter"),
            methods: [
                {
                    id: "counter",
                    labelKey: t("methodCounter"),
                    descKey: t("methodCounterDesc"),
                    icon: <Store className="h-5 w-5 text-amber-500" />,
                },
                {
                    id: "bank_transfer",
                    labelKey: t("methodBankTransfer"),
                    descKey: t("methodBankTransferDesc"),
                    icon: <Banknote className="h-5 w-5 text-blue-500" />,
                },
            ],
        },
    ];

    return (
        <div className="space-y-5" role="radiogroup" aria-label={t("groupLabel")}>
            {groups.map((group) => {
                // Filter methods based on enabledMethods (if provided)
                const visibleMethods = enabledMethods
                    ? group.methods.filter((m) => enabledMethods.includes(m.id))
                    : group.methods;

                // Hide entire group if no visible methods
                if (visibleMethods.length === 0) return null;

                return (
                    <div key={group.id} className="space-y-2">
                        <GroupHeading>{group.headingKey}</GroupHeading>
                        <div className="space-y-2">
                            {visibleMethods.map((method) => (
                                <MethodCard
                                    key={method.id}
                                    method={method}
                                    selected={selected === method.id}
                                    disabled={disabled}
                                    onSelect={onChange}
                                />
                            ))}
                        </div>
                    </div>
                );
            })}

            {/* Security indicator */}
            <div className="flex items-center gap-2 pt-1 px-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                <p className="text-[11px] text-gray-400">{t("secureNote")}</p>
            </div>
        </div>
    );
};

export default PaymentMethodSelector;
