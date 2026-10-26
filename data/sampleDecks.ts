import type { Card, Deck } from "@/types";

const SEED_TIMESTAMP = "2026-01-01T00:00:00.000Z";

type SeedCard = Omit<
  Card,
  "masteryLevel" | "lastReviewedAt" | "createdAt" | "updatedAt"
>;

type SeedDeck = Omit<Deck, "cards" | "createdAt" | "updatedAt"> & {
  cards: SeedCard[];
};

function createDeck(seed: SeedDeck): Deck {
  return {
    ...seed,
    cards: seed.cards.map((card) => ({
      ...card,
      masteryLevel: "new",
      lastReviewedAt: null,
      createdAt: SEED_TIMESTAMP,
      updatedAt: SEED_TIMESTAMP,
    })),
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
    mistakeCardIds: [],
  };
}

/** Built-in study material used the first time the app opens. */
export const SAMPLE_DECKS: Deck[] = [
  createDeck({
    id: "deck-computer-networks",
    title: "计算机网络高频考点",
    description:
      "把 TCP、HTTP、DNS 与浏览器网络串成一条线，适合面试前快速回忆。",
    cards: [
      {
        id: "net-tcp-three-way-handshake",
        question: "TCP 三次握手为什么不能简化成两次？",
        answer:
          "两次握手只能确认客户端到服务端的通道可用，服务端无法确认客户端已收到自己的初始序列号（ISN），也可能因历史连接请求误建立连接。三次握手可以同步双方 ISN，并让双方都确认收发能力。",
        explanation:
          "第三次 ACK 让服务端确认客户端已收到 SYN-ACK；若只有两次，迟到的旧 SYN 可能让服务端单向占用资源。",
        category: "传输层",
        tags: ["TCP", "握手"],
      },
      {
        id: "net-dns-resolution",
        question: "从输入 URL 到看到页面，DNS 解析通常发生在什么阶段？",
        answer:
          "在建立 TCP/TLS 连接之前，浏览器先检查自身 DNS 缓存、系统缓存与 hosts，再向递归 DNS 服务器查询域名对应的 IP；拿到 IP 后才能建立连接并发送 HTTP 请求。",
        explanation:
          "顺序可概括为：URL 解析 → 缓存检查 → DNS → TCP → TLS → HTTP → 渲染。",
        category: "应用层",
        tags: ["DNS", "浏览器"],
      },
      {
        id: "net-http2-multiplexing",
        question: "HTTP/1.1 与 HTTP/2 的核心差异是什么？",
        answer:
          "HTTP/2 在一条 TCP 连接上通过二进制分帧与流实现多路复用，避免 HTTP/1.1 的队头阻塞；同时支持头部压缩（HPACK）和服务器推送等机制。",
        explanation:
          "HTTP/1.1 的管线化仍受响应顺序限制；HTTP/2 的多个请求可并行交错，但仍可能受 TCP 层队头阻塞影响。",
        category: "应用层",
        tags: ["HTTP/2", "多路复用"],
      },
      {
        id: "net-https-security",
        question: "HTTPS 如何同时保证机密性与身份可信？",
        answer:
          "TLS 握手先用非对称加密或密钥交换协商出会话密钥，并验证服务器证书链；后续通信使用对称加密保证机密性和完整性。证书由受信任 CA 签发，用于确认服务器身份。",
        explanation:
          "非对称加密解决密钥分发与身份验证，对称加密解决大量数据的性能问题。",
        category: "网络安全",
        tags: ["HTTPS", "TLS"],
      },
      {
        id: "net-cors-preflight",
        question: "什么是 CORS 预检请求？哪些请求会触发？",
        answer:
          "跨域请求中，若方法不是 GET/HEAD/POST，或 POST 的 Content-Type 不是表单三类之一，或带有自定义请求头，浏览器会先发送 OPTIONS 预检请求，确认服务器允许后再发真实请求。",
        explanation:
          "服务器通过 Access-Control-Allow-Origin、-Methods、-Headers 等响应头授权；简单请求不触发预检。",
        category: "浏览器安全",
        tags: ["CORS", "预检"],
      },
      {
        id: "net-browser-storage",
        question: "Cookie、localStorage、sessionStorage 的主要区别？",
        answer:
          "Cookie 会随同源请求自动发送，容量约 4KB，可设置 HttpOnly/Secure；localStorage 容量约 5–10MB，持久保存但不随请求发送；sessionStorage 同样不随请求发送，但生命周期限于当前标签页会话。",
        explanation:
          "敏感登录态优先使用 HttpOnly + Secure + SameSite Cookie，避免被脚本读取。",
        category: "浏览器存储",
        tags: ["Cookie", "Storage"],
      },
      {
        id: "net-cdn-acceleration",
        question: "CDN 为什么能加速静态资源访问？",
        answer:
          "CDN 通过 DNS 或 Anycast 将用户调度到就近边缘节点，静态资源在边缘缓存并直接返回，减少骨干网传输、跨地域 RTT 和源站压力；未命中时再回源。",
        explanation:
          "命中率、缓存键设计和回源策略决定 CDN 效果；动态内容可通过边缘计算或动态加速优化。",
        category: "网络架构",
        tags: ["CDN", "缓存"],
      },
      {
        id: "net-get-vs-post",
        question: "GET 与 POST 的本质区别是什么？",
        answer:
          "二者都是 HTTP 方法，本质区别在语义：GET 用于安全、幂等地获取资源，参数通常在 URL；POST 用于提交数据、创建资源或产生副作用，数据通常在请求体。协议本身并不限制 POST 一定不可缓存或更安全。",
        explanation:
          "不要把“GET 参数可见、POST 更安全”当成安全边界；机密性应由 HTTPS 保证。",
        category: "应用层",
        tags: ["HTTP", "GET", "POST"],
      },
    ],
  }),
  createDeck({
    id: "deck-english-general",
    title: "英语高频表达与通识",
    description:
      "覆盖易混词汇、固定搭配与通识概念，用一张张卡片补足表达细节。",
    cards: [
      {
        id: "en-ephemeral",
        question: "ephemeral 是什么意思？请给出一个例句。",
        answer:
          "形容词：短暂的、转瞬即逝的。例句：Fame in the internet age can be ephemeral.",
        explanation:
          "常与 moment、beauty、trend 搭配；同义词有 transient、fleeting。",
        category: "词汇",
        tags: ["adjective", "C1"],
      },
      {
        id: "en-meticulous",
        question: "meticulous 是什么意思？常见搭配是什么？",
        answer:
          "一丝不苟的、注重细节的。常见搭配：be meticulous about/in something，如 She is meticulous about record-keeping.",
        explanation:
          "近义词：careful、thorough、painstaking；名词形式为 meticulousness。",
        category: "词汇",
        tags: ["adjective", "C1"],
      },
      {
        id: "en-in-light-of",
        question: "短语 in light of 如何使用？",
        answer:
          "表示“考虑到、鉴于”，后接名词或名词短语。例句：In light of recent changes, we revised the plan.",
        explanation:
          "正式书面表达，近义表达有 considering、given、in view of。",
        category: "短语",
        tags: ["writing", "formal"],
      },
      {
        id: "en-affect-vs-effect",
        question: "affect 与 effect 的词性和含义如何区分？",
        answer:
          "affect 通常作动词，表示“影响”；effect 通常作名词，表示“结果、影响”，作动词时意为“实现、引起”。",
        explanation:
          "例句：The policy affected thousands of families. / It had a lasting effect. 记忆：A(ffect) 是 Action，E(ffect) 是 End result。",
        category: "易混词",
        tags: ["grammar", "confusable"],
      },
      {
        id: "en-the-number-of",
        question: "The number of… 作主语时，谓语用单数还是复数？",
        answer:
          "用单数，因为中心词是 number。对比：a number of + 复数名词表示“许多”，作主语时谓语用复数。",
        explanation:
          "例句：The number of applicants is rising. / A number of applicants are waiting.",
        category: "语法",
        tags: ["agreement", "writing"],
      },
      {
        id: "en-ubiquitous",
        question: "ubiquitous 是什么意思？请给出一个例句。",
        answer:
          "形容词：无处不在的、十分普遍的。例句：Smartphones have become ubiquitous in daily life.",
        explanation:
          "近义词：omnipresent、pervasive；名词形式为 ubiquity。",
        category: "词汇",
        tags: ["adjective", "C1"],
      },
      {
        id: "en-take-for-granted",
        question: "take … for granted 的含义和常见句型是什么？",
        answer:
          "表示“认为……理所当然”或“不珍惜”。常见句型：take it for granted that + 从句；也可用被动形式 something is taken for granted。",
        explanation:
          "例句：We often take clean water for granted. 写作中常用来引出反思。",
        category: "短语",
        tags: ["idiom", "writing"],
      },
      {
        id: "general-opportunity-cost",
        question: "经济学中的“机会成本”指什么？",
        answer:
          "为了得到某种东西而放弃的其他选择中，价值最高的那一个。它衡量的是决策的隐性代价，而不仅是实际支出的钱。",
        explanation:
          "例：用两小时刷剧而不是复习，机会成本可能是这两小时本可获得的复习收益。",
        category: "通识",
        tags: ["economics", "thinking"],
      },
    ],
  }),
];
