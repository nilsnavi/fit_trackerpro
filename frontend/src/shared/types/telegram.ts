/**
 * Telegram WebApp API Types
 * Official Telegram WebApp types for TypeScript
 */

/**
 * Telegram User object
 * Contains information about the current user
 */
export interface TelegramUser {
    /** Unique identifier for this user or bot */
    id: number
    /** True if this user is a bot */
    is_bot?: boolean
    /** User's or bot's first name */
    first_name: string
    /** User's or bot's last name */
    last_name?: string
    /** User's or bot's username */
    username?: string
    /** IETF language tag of the user's language */
    language_code?: string
    /** True if this user is a Telegram Premium user */
    is_premium?: boolean
    /** True if this user added the bot to the attachment menu */
    added_to_attachment_menu?: boolean
    /** True if this user allowed the bot to message them */
    allows_write_to_pm?: boolean
    /** URL of the user's profile photo. The photo can be in .jpeg or .svg formats */
    photo_url?: string
}

/**
 * Telegram WebApp Chat object
 */
export interface WebAppChat {
    /** Unique identifier for this chat */
    id: number
    /** Type of chat */
    type: 'group' | 'supergroup' | 'channel'
    /** Title of the chat */
    title: string
    /** Username of the chat */
    username?: string
    /** URL of the chat's photo. The photo can be in .jpeg or .svg formats */
    photo_url?: string
}

/**
 * Telegram WebApp InitData
 */
export interface WebAppInitData {
    /** A unique identifier for the Web App session */
    query_id?: string
    /** An object containing data about the current user */
    user?: TelegramUser
    /** An object containing data about the chat partner of the current user in the chat where the bot was launched via the attachment menu */
    receiver?: TelegramUser
    /** An object containing data about the chat where the bot was launched via the attachment menu */
    chat?: WebAppChat
    /** Type of the chat where the bot was launched via the attachment menu */
    chat_type?: 'sender' | 'private' | 'group' | 'supergroup' | 'channel'
    /** A unique identifier for the chat where the bot was launched via the attachment menu */
    chat_instance?: string
    /** The value of the startattach or startapp parameter passed in the link */
    start_param?: string
    /** Time in seconds, after which a message can be sent via the answerWebAppQuery method */
    can_send_after?: number
    /** Unix time when the form was opened */
    auth_date: number
    /** A hash of all passed parameters, which the bot server can use to check their validity */
    hash: string
    /** Signature of all passed parameters */
    signature?: string
}

/**
 * Telegram Theme Params
 * Color scheme and theme parameters
 */
export interface ThemeParams {
    /** Background color in #RRGGBB format */
    bg_color?: string
    /** Main text color in #RRGGBB format */
    text_color?: string
    /** Hint text color in #RRGGBB format */
    hint_color?: string
    /** Link color in #RRGGBB format */
    link_color?: string
    /** Button color in #RRGGBB format */
    button_color?: string
    /** Button text color in #RRGGBB format */
    button_text_color?: string
    /** Secondary background color in #RRGGBB format */
    secondary_bg_color?: string
    /** Header background color in #RRGGBB format */
    header_bg_color?: string
    /** Accent text color in #RRGGBB format */
    accent_text_color?: string
    /** Section background color in #RRGGBB format */
    section_bg_color?: string
    /** Section header text color in #RRGGBB format */
    section_header_text_color?: string
    /** Subtitle text color in #RRGGBB format */
    subtitle_text_color?: string
    /** Destructive text color in #RRGGBB format */
    destructive_text_color?: string
}

/**
 * Haptic feedback impact styles
 */
export type HapticImpactStyle = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'

/**
 * Haptic feedback notification types
 */
export type HapticNotificationType = 'error' | 'success' | 'warning'

/**
 * Haptic feedback impactOccurred method
 */
export interface HapticFeedback {
    /** A method tells that an impact occurred */
    impactOccurred: (style: HapticImpactStyle) => HapticFeedback
    /** A method tells that a task or action has succeeded, failed, or produced a warning */
    notificationOccurred: (type: HapticNotificationType) => HapticFeedback
    /** A method tells that the user has changed a selection */
    selectionChanged: () => HapticFeedback
}

/**
 * BackButton object
 */
export interface BackButton {
    /** Shows whether the button is visible */
    isVisible: boolean
    /** A method to set the press event callback */
    onClick: (callback: () => void) => void
    /** A method to remove the press event callback */
    offClick: (callback: () => void) => void
    /** A method to make the button active and visible */
    show: () => void
    /** A method to hide the button */
    hide: () => void
}

/**
 * MainButton object
 */
export interface MainButton {
    /** Current button text */
    text: string
    /** Current button color */
    color: string
    /** Current button text color */
    textColor: string
    /** Shows whether the button is visible */
    isVisible: boolean
    /** Shows whether the button is active */
    isActive: boolean
    /** Readonly property. Shows whether the button has a progress spinner */
    isProgressVisible: boolean
    /** A method to set the button text */
    setText: (text: string) => MainButton
    /** A method to set the button press event callback */
    onClick: (callback: () => void) => void
    /** A method to remove the button press event callback */
    offClick: (callback: () => void) => void
    /** A method to show the button */
    show: () => MainButton
    /** A method to hide the button */
    hide: () => MainButton
    /** A method to enable the button */
    enable: () => MainButton
    /** A method to disable the button */
    disable: () => MainButton
    /** A method to show a loading spinner on the button */
    showProgress: (leaveActive?: boolean) => MainButton
    /** A method to hide the loading spinner */
    hideProgress: () => MainButton
    /** A method to set the button parameters */
    setParams: (params: MainButtonParams) => MainButton
}

/**
 * MainButton parameters
 */
export interface MainButtonParams {
    /** Button text */
    text?: string
    /** Button color */
    color?: string
    /** Button text color */
    text_color?: string
    /** Button visibility status */
    is_visible?: boolean
    /** Button active status */
    is_active?: boolean
}

/**
 * CloudStorage object
 */
export interface CloudStorage {
    /** Stores a value in the cloud storage */
    setItem: (key: string, value: string, callback?: (error: string | null, result?: boolean) => void) => void
    /** Receives a value from the cloud storage */
    getItem: (key: string, callback: (error: string | null, result?: string) => void) => void
    /** Receives values from the cloud storage */
    getItems: (keys: string[], callback: (error: string | null, result?: Record<string, string>) => void) => void
    /** Removes a value from the cloud storage */
    removeItem: (key: string, callback?: (error: string | null, result?: boolean) => void) => void
    /** Removes values from the cloud storage */
    removeItems: (keys: string[], callback?: (error: string | null, result?: boolean) => void) => void
    /** Receives keys from the cloud storage */
    getKeys: (callback: (error: string | null, result?: string[]) => void) => void
}

/**
 * Unsafe init data from URL
 */
export interface WebAppInitDataUnsafe {
    /** A unique identifier for the Web App session */
    query_id?: string
    /** An object containing data about the current user */
    user?: TelegramUser
    /** An object containing data about the chat partner of the current user in the chat where the bot was launched via the attachment menu */
    receiver?: TelegramUser
    /** An object containing data about the chat where the bot was launched via the attachment menu */
    chat?: WebAppChat
    /** Type of the chat where the bot was launched via the attachment menu */
    chat_type?: 'sender' | 'private' | 'group' | 'supergroup' | 'channel'
    /** A unique identifier for the chat where the bot was launched via the attachment menu */
    chat_instance?: string
    /** The value of the startattach or startapp parameter passed in the link */
    start_param?: string
    /** Time in seconds, after which a message can be sent via the answerWebAppQuery method */
    can_send_after?: number
    /** Unix time when the form was opened */
    auth_date: number
    /** A hash of all passed parameters, which the bot server can use to check their validity */
    hash: string
    /** Signature of all passed parameters */
    signature?: string
}

/**
 * WebApp API interface
 */
export interface WebApp {
    /** The version of the Bot API available in the user's Telegram app */
    version: string
    /** The name of the platform */
    platform: string
    /** The color scheme currently used in the Telegram app */
    colorScheme: 'light' | 'dark'
    /** An object containing the current theme settings */
    themeParams: ThemeParams
    /** True if the Web App is expanded to the maximum possible height */
    isExpanded: boolean
    /** The current height of the visible area of the Web App */
    viewportHeight: number
    /** The height of the visible area of the Web App in its last stable state */
    viewportStableHeight: number
    /** Current header color */
    headerColor: string
    /** Current background color */
    backgroundColor: string
    /** True if the confirmation dialog is enabled while closing the Web App */
    isClosingConfirmationEnabled: boolean
    /** An object for controlling the back button */
    BackButton: BackButton
    /** An object for controlling the main button */
    MainButton: MainButton
    /** An object for controlling haptic feedback */
    HapticFeedback: HapticFeedback
    /** An object for controlling cloud storage */
    CloudStorage: CloudStorage
    /** Raw init data string */
    initData: string
    /** Parsed init data object */
    initDataUnsafe: WebAppInitDataUnsafe
    /** A method to initialize the Web App */
    ready: () => void
    /** A method to expand the Web App to the maximum possible height */
    expand: () => void
    /** A method to close the Web App */
    close: () => void
    /** A method to enable the confirmation dialog while closing the Web App */
    enableClosingConfirmation: () => void
    /** A method to disable the confirmation dialog while closing the Web App */
    disableClosingConfirmation: () => void
    /** A method to set the header color */
    setHeaderColor: (color: 'bg_color' | 'secondary_bg_color' | string) => void
    /** A method to set the background color */
    setBackgroundColor: (color: 'bg_color' | 'secondary_bg_color' | string) => void
    /** A method to send data to the bot */
    sendData: (data: string) => void
    /** A method to open a link in an external browser */
    openLink: (url: string, options?: { try_instant_view?: boolean }) => void
    /** A method to open a Telegram link inside Telegram app */
    openTelegramLink: (url: string) => void
    /** A method to open an invoice */
    openInvoice: (url: string, callback?: (status: 'paid' | 'cancelled' | 'failed' | 'pending') => void) => void
    /** A method to show a native popup */
    showPopup: (params: PopupParams, callback?: (button_id: string | null) => void) => void
    /** A method to show an alert */
    showAlert: (message: string, callback?: () => void) => void
    /** A method to show a confirmation */
    showConfirm: (message: string, callback?: (is_confirmed: boolean) => void) => void
    /** A method to show a scan QR popup */
    showScanQrPopup: (params: QrPopupParams, callback?: (text: string | null) => void) => void
    /** A method to close the scan QR popup */
    closeScanQrPopup: () => void
    /** A method to read text from clipboard */
    readTextFromClipboard: (callback?: (text: string | null) => void) => void
    /** A method to request write access */
    requestWriteAccess: (callback?: (is_granted: boolean) => void) => void
    /** A method to request contact */
    requestContact: (callback?: (is_shared: boolean) => void) => void
    /** A method to invoke custom method */
    invokeCustomMethod: (method: string, params: object, callback?: (error: string | null, result?: object) => void) => void
    /** Event handler for theme changes */
    onEvent: (eventType: WebAppEventType, eventHandler: () => void) => void
    /** Remove event handler */
    offEvent: (eventType: WebAppEventType, eventHandler: () => void) => void
}

/**
 * Popup parameters
 */
export interface PopupParams {
    /** The text to be displayed in the popup title */
    title?: string
    /** The message to be displayed in the body of the popup */
    message: string
    /** List of buttons to be displayed */
    buttons?: PopupButton[]
}

/**
 * Popup button
 */
export interface PopupButton {
    /** Button ID */
    id?: string
    /** Button type */
    type?: 'default' | 'ok' | 'close' | 'cancel' | 'destructive'
    /** Button text */
    text?: string
}

/**
 * QR Popup parameters
 */
export interface QrPopupParams {
    /** The text to be displayed under the QR code scanner */
    text?: string
}

/**
 * WebApp event types
 */
export type WebAppEventType =
    | 'themeChanged'
    | 'viewportChanged'
    | 'mainButtonClicked'
    | 'backButtonClicked'
    | 'settingsButtonClicked'
    | 'invoiceClosed'
    | 'popupClosed'
    | 'qrTextReceived'
    | 'clipboardTextReceived'
    | 'writeAccessRequested'
    | 'contactRequested'

// Global `Window.Telegram` augmentation lives in `src/types/telegram.d.ts`.
