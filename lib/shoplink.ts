// ShopLink API client. Self-contained: copy this file into any JS/TS project (Next.js, React, Vite,
// a Node script, a Telegram bot...) and point it at the backend with createShoplinkClient({ baseUrl }).

export type Source = "tiktok" | "instagram" | "telegram" | "other";
export type Role = "customer" | "admin";
export type OrderStatus = "new" | "confirmed" | "shipped" | "delivered" | "cancelled";
export type LoginMethod = "register" | "password" | "telegram" | "tiktok" | "instagram";

export interface User {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  role: Role;
  source: Source;
  socialUsername: string | null;
  /** Always set: the uploaded picture, or a colored circle with the user's initials. */
  avatarUrl: string;
  hasAvatar: boolean;
  telegramId: number | null;
  /** Set when the user logged in with TikTok. */
  tiktokId: string | null;
  /** Set when the user logged in with Instagram. */
  instagramId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUser extends User {
  lastLoginAt: string | null;
  loginCount: number;
  ordersCount: number;
}

export interface LoginRecord {
  id: number;
  userId: number;
  userName: string;
  method: LoginMethod;
  createdAt: string;
}

export interface AdminUserDetail extends AdminUser {
  recentLogins: LoginRecord[];
}

interface PeriodCounts {
  today: number;
  last7Days: number;
  last30Days: number;
}

export interface UserStats {
  totalUsers: number;
  customers: number;
  admins: number;
  bySource: Record<Source, number>;
  registered: PeriodCounts;
  activeUsers: PeriodCounts;
  logins: PeriodCounts & { total: number };
  loginsByMethod: Record<LoginMethod, number>;
  neverLoggedIn: number;
  timeZone: string;
  daily: { date: string; registered: number; activeUsers: number; logins: number }[];
}

export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  rating: number;
  stock: number;
  inStock: boolean;
  sizes: string[];
  colors: string[];
  category: Category;
  /** Always set: the uploaded picture, the given URL, or a gray "No image" picture. */
  imageUrl: string;
  hasImage: boolean;
  /** More pictures, shown after imageUrl (up to 10). */
  images: string[];
  /** How many customer reviews it has. */
  reviewsCount: number;
  /** Average stars of those reviews, 1 to 5 (null when there are none). */
  reviewsRating: number | null;
  sellerId: number | null;
  /** Who sells it. Sent only once the backend includes it; until then there's just sellerId. */
  seller?: ProductSeller | null;
  createdAt: string;
  updatedAt: string;
}

/** What anyone may see about a person (search results): no email, no phone. */
export interface Person {
  id: number;
  name: string;
  socialUsername: string | null;
  avatarUrl: string;
  /** How many products they sell. */
  productsCount: number;
}

/** The public part of a seller, sent with their products. */
export interface ProductSeller {
  id: number;
  name: string;
  socialUsername: string | null;
  avatarUrl: string;
  /** Admins get the hammer badge next to their name. */
  isAdmin?: boolean;
}

/** Why someone reported a product. */
export const REPORT_REASONS = ["fake", "scam", "offensive", "wrong_info", "prohibited", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
/** open: waiting for an admin; resolved: the admin acted; dismissed: nothing wrong. */
export type ReportStatus = "open" | "resolved" | "dismissed";

export interface Report {
  id: number;
  productId: number;
  product: Product;
  reporterId: number;
  reporterName: string;
  reporterUsername: string | null;
  reporterAvatarUrl: string;
  reason: ReportReason;
  note: string;
  status: ReportStatus;
  createdAt: string;
  updatedAt: string;
}

/** Something that happened for you: a sale of your product, a reported product (admins). Arrives live too. */
export interface AppNotification {
  id: number;
  type: "sale" | "report" | string;
  /** English text; the shop writes its own from `data` in the reader’s language. */
  title: string;
  body: string;
  link: string | null;
  imageUrl: string | null;
  data: {
    buyerName?: string;
    items?: { name: string; quantity: number }[];
    quantity?: number;
    total?: number;
    orderNumber?: string;
    orderId?: number;
    productId?: number;
    productName?: string;
    reason?: ReportReason;
    reporterName?: string;
    status?: OrderStatus;
  };
  read: boolean;
  createdAt: string;
}

export interface ReportPage extends Page<Report> {
  counts: Record<ReportStatus, number>;
}

export interface OrderItem {
  id: number;
  productId: number | null;
  productName: string;
  sellerId: number | null;
  size: string | null;
  color: string | null;
  quantity: number;
  price: number;
  subtotal: number;
}

export interface Order {
  id: number;
  /** e.g. "SL-7K3F9QX2" */
  orderNumber: string;
  userId: number;
  status: OrderStatus;
  customerName: string;
  phone: string;
  address: string;
  comment: string | null;
  source: Source;
  total: number;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
  /** Sales only: every item in the order is mine, so I move it through its steps myself. */
  sellerCanManage?: boolean;
}

export interface Review {
  id: number;
  productId: number;
  userId: number;
  userName: string;
  userAvatarUrl: string;
  /** Stars, 1 to 5. */
  rating: number;
  comment: string;
  createdAt: string;
  updatedAt: string;
}

export type ReviewSort = "newest" | "rating_desc" | "rating_asc";

/** Free-text comment on a product: as many as people like (stars are in Review, one per person). */
export interface ProductComment {
  id: number;
  productId: number;
  userId: number;
  userName: string;
  userUsername: string | null;
  userAvatarUrl: string;
  /** Admins get the hammer badge next to their name. */
  userIsAdmin?: boolean;
  text: string;
  edited: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CommentSort = "newest" | "oldest";

export interface WishlistItem {
  id: number;
  productId: number;
  product: Product;
  createdAt: string;
}

export interface CartItem {
  id: number;
  productId: number;
  product: Product;
  size: string | null;
  color: string | null;
  quantity: number;
  price: number;
  subtotal: number;
  /** False when the product sold out or has fewer left than this quantity. */
  available: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Cart {
  items: CartItem[];
  totalQuantity: number;
  total: number;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface PageQuery {
  page?: number;
  /** 1 to 100, default 20. */
  limit?: number;
}

export type ProductSort = "newest" | "price_asc" | "price_desc" | "rating_desc" | "name_asc";

/** What a product is, for browsing by category (the backend's list). Older products are "other". */
export const CATEGORIES = ["hoodies", "t-shirts", "jeans", "dresses", "bags", "shoes", "jackets", "accessories", "other"] as const;
export type Category = (typeof CATEGORIES)[number];

export interface ProductQuery extends PageQuery {
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  size?: string;
  color?: string;
  category?: Category;
  inStock?: boolean;
  sellerId?: number;
  sort?: ProductSort;
}

export interface ProductInput {
  name: string;
  description?: string;
  price: number;
  rating?: number;
  stock: number;
  sizes?: string[];
  colors?: string[];
  category?: Category;
  imageUrl?: string | null;
}

export interface Delivery {
  address: string;
  /** Defaults to the profile name. */
  customerName?: string;
  /** Defaults to the profile phone. */
  phone?: string;
  comment?: string;
}

export interface NewOrder extends Delivery {
  items: { productId: number; quantity: number; size?: string; color?: string }[];
}

export type ProfileUpdate = Partial<{
  name: string;
  email: string | null;
  phone: string | null;
  source: Source;
  socialUsername: string | null;
}>;

/** Thrown for any non-2xx response. `errors` lists the individual problems, each starting with its field name. */
export class ShoplinkError extends Error {
  constructor(
    public status: number,
    message: string,
    public errors: string[] = [],
  ) {
    super(message);
    this.name = "ShoplinkError";
  }
}

export interface ClientOptions {
  /** Where the backend runs, e.g. "http://localhost:4000" or "https://api.myshop.com". */
  baseUrl: string;
  /** Returns the saved login token, if any. Defaults to localStorage in the browser. */
  getToken?: () => string | null | undefined;
  /** Saves (or clears, with null) the token after login/register/logout. Defaults to localStorage. */
  setToken?: (token: string | null) => void;
  /** Called with +1 when a request starts and -1 when it ends, with its method (e.g. for loading bars). */
  onActivity?: (change: 1 | -1, method: string) => void;
}

const TOKEN_KEY = "shoplink_token";

function browserStorage() {
  try {
    return typeof window !== "undefined" ? window.localStorage : undefined;
  } catch {
    return undefined; // storage blocked (private mode etc.)
  }
}

export function createShoplinkClient({
  baseUrl,
  getToken = () => browserStorage()?.getItem(TOKEN_KEY),
  setToken = (token) => {
    const storage = browserStorage();
    if (token) storage?.setItem(TOKEN_KEY, token);
    else storage?.removeItem(TOKEN_KEY);
  },
  onActivity,
}: ClientOptions) {
  const root = baseUrl.replace(/\/+$/, "");

  async function request<T>(method: string, path: string, body?: unknown, query?: object): Promise<T> {
    const url = new URL(root + path);
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
    }
    const headers: Record<string, string> = {};
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    // FormData (picture uploads) sets its own multipart Content-Type.
    const isForm = body instanceof FormData;
    if (body !== undefined && !isForm) headers["Content-Type"] = "application/json";

    let res: Response;
    let text: string;
    onActivity?.(1, method);
    try {
      res = await fetch(url, {
        method,
        headers,
        body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
      });
      text = await res.text();
    } catch {
      throw new ShoplinkError(0, `Can't reach the ShopLink backend at ${root}. Is it running?`);
    } finally {
      onActivity?.(-1, method);
    }
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) throw new ShoplinkError(res.status, data?.message ?? res.statusText, data?.errors);
    return data as T;
  }

  async function saveAuth(promise: Promise<AuthResponse>) {
    const auth = await promise;
    setToken(auth.token);
    return auth;
  }

  function imageForm(file: Blob) {
    const form = new FormData();
    form.append("image", file);
    return form;
  }

  /**
   * Picture uploads with progress (fetch can't report upload progress, XMLHttpRequest can).
   * `onProgress` gets 0 to 1 as the files are sent.
   */
  function upload<T>(method: string, path: string, form: FormData, onProgress?: (done: number) => void): Promise<T> {
    if (!onProgress) return request<T>(method, path, form);
    return new Promise<T>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(method, root + path);
      const token = getToken();
      if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
      // No onActivity here: these uploads show their own, exact progress.
      xhr.onload = () => {
        let data: { message?: string; errors?: string[] } | null = null;
        try {
          data = xhr.responseText ? JSON.parse(xhr.responseText) : null;
        } catch {
          // not JSON (e.g. a proxy error page)
        }
        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress(1);
          resolve(data as T);
        } else reject(new ShoplinkError(xhr.status, data?.message ?? xhr.statusText, data?.errors));
      };
      xhr.onerror = () => {
        reject(new ShoplinkError(0, `Can't reach the ShopLink backend at ${root}. Is it running?`));
      };
      xhr.send(form);
    });
  }

  return {
    /** Picture addresses from the API can be relative ("/api/uploads/..."); this makes them absolute. */
    assetUrl: (path: string) => (path.startsWith("/") ? root + path : path),

    auth: {
      register: (data: {
        name: string;
        password: string;
        email?: string;
        phone?: string;
        source?: Source;
        socialUsername?: string;
      }) => saveAuth(request<AuthResponse>("POST", "/api/auth/register", data)),
      /** `login` is an email or a phone number. */
      login: (login: string, password: string) =>
        saveAuth(request<AuthResponse>("POST", "/api/auth/login", { login, password })),
      /** Data from the Telegram Login Widget callback. */
      telegram: (widgetData: Record<string, unknown>) =>
        saveAuth(request<AuthResponse>("POST", "/api/auth/telegram", widgetData)),
      /** `window.Telegram.WebApp.initData` inside a Telegram Mini App. */
      telegramWebApp: (initData: string) =>
        saveAuth(request<AuthResponse>("POST", "/api/auth/telegram-webapp", { initData })),
      /** Where to send the user to log in with TikTok / Instagram. Check `state` when they come back. */
      oauthUrl: (provider: "tiktok" | "instagram", state?: string) =>
        request<{ url: string }>("GET", `/api/auth/${provider}/url`, undefined, { state }),
      /** The `code` from the TikTok / Instagram redirect. */
      oauth: (provider: "tiktok" | "instagram", code: string) =>
        saveAuth(request<AuthResponse>("POST", `/api/auth/${provider}`, { code })),
      logout: () => setToken(null),
      isLoggedIn: () => Boolean(getToken()),
      me: () => request<User>("GET", "/api/auth/me"),
      updateMe: (data: ProfileUpdate) => request<User>("PATCH", "/api/auth/me", data),
      /** JPEG, PNG, WebP or GIF, up to 5 MB. */
      uploadAvatar: (file: Blob) => request<User>("PUT", "/api/auth/me/avatar", imageForm(file)),
      removeAvatar: () => request<User>("DELETE", "/api/auth/me/avatar"),
    },
    products: {
      list: (query: ProductQuery = {}) => request<Page<Product>>("GET", "/api/products", undefined, query),
      /** The products I sell. */
      mine: (query: ProductQuery = {}) => request<Page<Product>>("GET", "/api/products/mine", undefined, query),
      get: (id: number) => request<Product>("GET", `/api/products/${id}`),
      // Any user can sell; only the seller or an admin can change or delete a product.
      create: (data: ProductInput) => request<Product>("POST", "/api/products", data),
      update: (id: number, data: Partial<ProductInput>) => request<Product>("PATCH", `/api/products/${id}`, data),
      remove: (id: number) => request<null>("DELETE", `/api/products/${id}`),
      /** JPEG, PNG, WebP or GIF, up to 5 MB. */
      uploadImage: (id: number, file: Blob) => request<Product>("PUT", `/api/products/${id}/image`, imageForm(file)),
      removeImage: (id: number) => request<Product>("DELETE", `/api/products/${id}/image`),
      /** The main picture with upload progress (0 to 1). */
      uploadMainImage: (id: number, file: Blob, onProgress?: (done: number) => void) =>
        upload<Product>("PUT", `/api/products/${id}/image`, imageForm(file), onProgress),
      /** Adds more pictures (up to 10 besides the main one), with upload progress (0 to 1). */
      addImages: (id: number, files: Blob[], onProgress?: (done: number) => void) => {
        const form = new FormData();
        for (const f of files) form.append("images", f);
        return upload<Product>("POST", `/api/products/${id}/images`, form, onProgress);
      },
      /** Removes one of the extra pictures; `url` is its address from `images`. */
      removeExtraImage: (id: number, url: string) =>
        request<Product>("DELETE", `/api/products/${id}/images/${encodeURIComponent(url.split("/").pop() ?? "")}`),
    },
    people: {
      /** Anyone can search people by name or @username (a leading "@" is fine). */
      search: (search: string, query: PageQuery = {}) => request<Page<Person>>("GET", "/api/people", undefined, { search, ...query }),
    },
    reviews: {
      list: (productId: number, query: { sort?: ReviewSort } & PageQuery = {}) =>
        request<Page<Review>>("GET", `/api/products/${productId}/reviews`, undefined, query),
      /** My review of this product (404 if I haven't written one). */
      mine: (productId: number) => request<Review>("GET", `/api/products/${productId}/reviews/mine`),
      /** One per product; not for your own products. */
      create: (productId: number, review: { rating: number; comment?: string }) =>
        request<Review>("POST", `/api/products/${productId}/reviews`, review),
      update: (productId: number, id: number, review: { rating?: number; comment?: string }) =>
        request<Review>("PATCH", `/api/products/${productId}/reviews/${id}`, review),
      /** Your own review (admins: any). */
      remove: (productId: number, id: number) => request<null>("DELETE", `/api/products/${productId}/reviews/${id}`),
    },
    comments: {
      list: (productId: number, query: { sort?: CommentSort } & PageQuery = {}) =>
        request<Page<ProductComment>>("GET", `/api/products/${productId}/comments`, undefined, query),
      create: (productId: number, text: string) => request<ProductComment>("POST", `/api/products/${productId}/comments`, { text }),
      update: (productId: number, id: number, text: string) => request<ProductComment>("PATCH", `/api/products/${productId}/comments/${id}`, { text }),
      /** Your own; the product's seller and admins can delete any. */
      remove: (productId: number, id: number) => request<null>("DELETE", `/api/products/${productId}/comments/${id}`),
    },
    wishlist: {
      list: (query: PageQuery = {}) => request<Page<WishlistItem>>("GET", "/api/wishlist", undefined, query),
      /** Adding the same product twice is fine. */
      add: (productId: number) => request<WishlistItem>("POST", "/api/wishlist", { productId }),
      remove: (productId: number) => request<null>("DELETE", `/api/wishlist/product/${productId}`),
      clear: () => request<null>("DELETE", "/api/wishlist"),
    },
    cart: {
      get: () => request<Cart>("GET", "/api/cart"),
      /** Same product, size and color adds up. Size/color are required when the product has them. */
      add: (item: { productId: number; quantity?: number; size?: string; color?: string }) =>
        request<CartItem>("POST", "/api/cart", item),
      /** Sets the quantity (not added to the old one). */
      setQuantity: (id: number, quantity: number) => request<CartItem>("PATCH", `/api/cart/${id}`, { quantity }),
      remove: (id: number) => request<null>("DELETE", `/api/cart/${id}`),
      clear: () => request<null>("DELETE", "/api/cart"),
      /** Orders everything in the cart and empties it. */
      checkout: (delivery: Delivery) => request<Order>("POST", "/api/cart/checkout", delivery),
    },
    orders: {
      create: (order: NewOrder) => request<Order>("POST", "/api/orders", order),
      /** My own orders. */
      list: (query: { status?: OrderStatus } & PageQuery = {}) =>
        request<Page<Order>>("GET", "/api/orders", undefined, query),
      get: (id: number) => request<Order>("GET", `/api/orders/${id}`),
      /** Find my order by its number, e.g. "SL-7K3F9QX2". */
      byNumber: (orderNumber: string) => request<Order>("GET", `/api/orders/number/${encodeURIComponent(orderNumber)}`),
      /** Only while it is `new`. */
      cancel: (id: number) => request<Order>("POST", `/api/orders/${id}/cancel`),
      /** Orders for the products I sell (only my items, `total` for my items). */
      sales: (query: { status?: OrderStatus } & PageQuery = {}) =>
        request<Page<Order>>("GET", "/api/orders/sales", undefined, query),
      /** One of my sales (only my items). */
      sale: (id: number) => request<Order>("GET", `/api/orders/sales/${id}`),
      /** Moves one of my sales along; only when `sellerCanManage` (every item in it is mine). The buyer is notified. */
      setSaleStatus: (id: number, status: OrderStatus) => request<Order>("PATCH", `/api/orders/sales/${id}/status`, { status }),
      // Admin only:
      all: (query: { status?: OrderStatus; userId?: number } & PageQuery = {}) =>
        request<Page<Order>>("GET", "/api/orders/all", undefined, query),
      setStatus: (id: number, status: OrderStatus) => request<Order>("PATCH", `/api/orders/${id}/status`, { status }),
    },
    notifications: {
      list: (query: PageQuery = {}) => request<Page<AppNotification> & { unread: number }>("GET", "/api/notifications", undefined, query),
      /** The given ones, or all of them. */
      markRead: (ids?: number[]) => request<{ unread: number }>("POST", "/api/notifications/read", ids ? { ids } : {}),
      /** Live stream (Server-Sent Events) address; EventSource can’t send headers, so the token goes in the URL. */
      streamUrl: (token: string) => `${root}/api/notifications/stream?token=${encodeURIComponent(token)}`,
    },
    reports: {
      /** Any logged-in user, not for your own products. Reporting again replaces your reason. */
      create: (report: { productId: number; reason: ReportReason; note?: string }) =>
        request<{ id: number; productId: number; reason: ReportReason; status: ReportStatus; createdAt: string }>("POST", "/api/reports", report),
      // Admin only:
      list: (query: { status?: ReportStatus } & PageQuery = {}) => request<ReportPage>("GET", "/api/reports", undefined, query),
      update: (id: number, status: ReportStatus) => request<Report>("PATCH", `/api/reports/${id}`, { status }),
      /** Closes every open report on the product at once. */
      closeProduct: (productId: number, status: ReportStatus) =>
        request<{ updated: number }>("POST", `/api/reports/product/${productId}`, { status }),
    },
    // Admin only:
    users: {
      stats: (days?: number) => request<UserStats>("GET", "/api/users/stats", undefined, { days }),
      list: (
        query: {
          search?: string;
          source?: Source;
          role?: Role;
          sort?: "newest" | "oldest" | "lastLogin" | "mostLogins" | "name";
        } & PageQuery = {},
      ) => request<Page<AdminUser>>("GET", "/api/users", undefined, query),
      get: (id: number) => request<AdminUserDetail>("GET", `/api/users/${id}`),
      logins: (query: { userId?: number; method?: LoginMethod } & PageQuery = {}) =>
        request<Page<LoginRecord>>("GET", "/api/users/logins", undefined, query),
    },
    health: () => request<{ status: string; database: string }>("GET", "/health"),
  };
}

export type ShoplinkClient = ReturnType<typeof createShoplinkClient>;
