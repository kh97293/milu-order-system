import {
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import React, { useMemo, useState } from "react";

const paymentFilters = ["全部", "待匯定", "等待款項確認中", "未付款", "已付款"];

const CUSTOMER_SERVICE_LINK = "https://lin.ee/NQwZi4A";

// 這裡換成你的 Apps Script Web App 網址，結尾要是 /exec
const PAYMENT_REPORT_WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbycG2dD6dKiPIkgG5ecUZGVZB3hPdBYFw55RYGiPNSVoi9bLf5zWajj97MfDo9SRFcAZw/exec";

export default function App() {
  const [step, setStep] = useState(1);
  const [nickname, setNickname] = useState("");
  const [orders, setOrders] = useState([]);
  const [mainFilter, setMainFilter] = useState("全部");
  const [paymentFilter, setPaymentFilter] = useState("全部");
  const [shippingFilter, setShippingFilter] = useState("全部");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showError, setShowError] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [lastFive, setLastFive] = useState("");

  const openCustomerService = () => {
    window.open(CUSTOMER_SERVICE_LINK, "_blank");
  };

  const filteredOrders = useMemo(() => {
    let list = orders;
    if (mainFilter === "已登記")
      return list.filter((o) => o.phase === "已登記");
    if (mainFilter === "已購入") {
      list = list.filter((o) => o.phase === "已購入");
      if (paymentFilter !== "全部")
        list = list.filter((o) => o.paymentStatus === paymentFilter);
      if (shippingFilter !== "全部")
        list = list.filter((o) => o.shippingStatus === shippingFilter);
      return list;
    }
    return list;
  }, [orders, mainFilter, paymentFilter, shippingFilter]);

  const checkNickname = async () => {
    const q = query(
      collection(db, "orders"),
      where("nickname", "==", nickname.trim())
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      setShowError(true);
      return;
    }

    const result = snapshot.docs.map((doc) => {
      const data = doc.data();

      return {
        id: doc.id,
        groupName: data.groupName,
        phase: data.status,
        paymentStatus: data.paymentStatus,
        shippingStatus: data.shippingStatus,
        itemCount: data.totalItems,
        totalAmount: data.totalAmount,
        items: data.items || [],
      };
    });

    setOrders(result);
    setStep(2);
  };

  const deposit = selectedOrder
    ? Math.floor(selectedOrder.totalAmount * 0.5)
    : 0;
  const finalPayment = selectedOrder ? selectedOrder.totalAmount - deposit : 0;

  const reportPayment = async () => {
    if (lastFive.length !== 5) {
      alert("請輸入匯款後五碼");
      return;
    }

    if (!selectedOrder) return;

    const paymentReport = `${nickname.trim()}付款完成
付款項目：${selectedOrder.groupName}
喊單總額：NT$ ${selectedOrder.totalAmount.toLocaleString()}
轉帳金額：NT$ ${deposit.toLocaleString()}
末五碼：${lastFive}`;

    try {
      await updateDoc(doc(db, "orders", selectedOrder.id), {
        paymentLastFive: lastFive,
        paymentReport,
        paymentReportStatus: "已通知匯款",
        paymentReportedAt: serverTimestamp(),
        paymentStatus: "等待款項確認中",
      });

      await fetch(PAYMENT_REPORT_WEBAPP_URL, {
        method: "POST",
        mode: "no-cors",
        body: JSON.stringify({
          orderId: selectedOrder.id,
          nickname: nickname.trim(),
          groupName: selectedOrder.groupName,
          totalAmount: selectedOrder.totalAmount,
          transferAmount: deposit,
          lastFive,
        }),
      });

      setShowCodeModal(false);
      setStep(5);
    } catch (error) {
      alert("回報失敗，請稍後再試或聯絡客服");
      console.error(error);
    }
  };

  return (
    <div style={styles.page}>
      <main style={styles.panel}>
        <header style={styles.header}>
          <div style={styles.brand}>⋆✧*✩咪路麋鹿 動漫代購⋆✧*✩</div>
        </header>

        {step === 1 && (
          <>
            <div style={styles.heroImage}></div>

            <section style={styles.homeFormCard}>
              <h2 style={styles.title}>🔎 查詢訂單</h2>
              <p style={styles.helperText}>輸入社群暱稱，查詢您的訂單進度 ☁️</p>

              <input
                style={styles.input}
                placeholder="請輸入暱稱"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
              />

              <button style={styles.primaryBtn} onClick={checkNickname}>
                查詢我的訂單🧾
              </button>
            </section>
          </>
        )}

        {step === 2 && (
          <>
            <button style={styles.backBtn} onClick={() => setStep(1)}>
              ← 返回
            </button>

            <section style={styles.filterCard}>
              <div style={styles.summaryRow}>
                <span style={styles.selectPill}>🧾 訂單篩選</span>
                <span style={styles.orderCount}>
                  共 {filteredOrders.length} 個訂單
                </span>
              </div>

              <div style={styles.mainTabs}>
                {["全部", "已登記", "已購入"].map((filter) => (
                  <button
                    key={filter}
                    style={{
                      ...styles.filterTab,
                      ...(mainFilter === filter ? styles.filterTabActive : {}),
                    }}
                    onClick={() => {
                      setMainFilter(filter);
                      setPaymentFilter("全部");
                      setShippingFilter("全部");
                    }}
                  >
                    {filter === "全部"
                      ? "📂 全部"
                      : filter === "已登記"
                      ? "📑已登記"
                      : "🛒 已購入"}
                  </button>
                ))}
              </div>

              {mainFilter === "已購入" && (
                <div style={styles.filterGroups}>
                  <div style={styles.filterLabel}>💳 付款狀態</div>
                  <div style={styles.chipWrap}>
                    {paymentFilters.map((filter) => (
                      <button
                        key={filter}
                        style={{
                          ...styles.chip,
                          ...(paymentFilter === filter
                            ? styles.chipActive
                            : {}),
                        }}
                        onClick={() => setPaymentFilter(filter)}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {filteredOrders.length === 0 ? (
              <section style={styles.emptyCard}>
                <div style={styles.emptyIcon}>☁️</div>
                <h3>沒有相關訂單</h3>
                <p>可以換個篩選條件看看唷☁️</p>
              </section>
            ) : (
              filteredOrders.map((order) => (
                <section
                  key={order.id}
                  style={styles.orderCard}
                  onClick={() => {
                    setSelectedOrder(order);
                    setStep(3);
                  }}
                >
                  <div style={styles.tags}>
                    <span style={styles.tagBlue}>
                      {order.phase === "已登記" ? "📑 已登記" : "🛒 已購入"}
                    </span>
                    {order.paymentStatus && (
                      <span style={styles.tagCream}>
                        💳 {order.paymentStatus}
                      </span>
                    )}
                    {order.shippingStatus && (
                      <span style={styles.tagCloud}>
                        📦 {order.shippingStatus}
                      </span>
                    )}
                  </div>

                  <h2 style={styles.orderTitle}>{order.groupName}</h2>

                  <div style={styles.orderFooter}>
                    <span style={styles.qty}>共 {order.itemCount} 件</span>
                    <div style={styles.totalBox}>
                      <span style={styles.totalLabel}>商品總額</span>
                      <strong style={styles.total}>
                        NT$ {order.totalAmount.toLocaleString()}
                      </strong>
                    </div>
                  </div>
                </section>
              ))
            )}
          </>
        )}

        {step === 3 && selectedOrder && (
          <section style={styles.card}>
            <button style={styles.backBtn} onClick={() => setStep(2)}>
              ← 返回
            </button>

            {selectedOrder.phase === "已登記" ? (
              <>
                <div style={styles.detailHeader}>
                  <div style={styles.titleRow}>
                    <h2 style={styles.orderTitle}>{selectedOrder.groupName}</h2>

                    <div style={styles.noticeBox}>⏳ 等待通知匯款中</div>
                  </div>

                  <div style={styles.infoOne}>
                    <span>商品總金額</span>
                    <strong>
                      NT$ {selectedOrder.totalAmount.toLocaleString()}
                    </strong>
                  </div>
                </div>

                <div style={styles.detailBox}>
                  <h3 style={styles.sectionTitle}>🛍️購買商品明細</h3>
                  {selectedOrder.items.map((item, index) => (
                    <div key={index} style={styles.itemRow}>
                      <span>
                        {item.name} × {item.qty}
                      </span>
                      <span>
                        NT$ {(item.price * item.qty).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>

                <button
                  style={styles.secondaryBtn}
                  onClick={openCustomerService}
                >
                  💬 聯絡客服
                </button>
              </>
            ) : (
              <>
                <div style={styles.tags}>
                  <span style={styles.tagBlue}>
                    {selectedOrder.phase === "已登記"
                      ? "📑 已登記"
                      : "🛒 已購入"}
                  </span>
                  <span style={styles.tagCream}>
                    💳 {selectedOrder.paymentStatus}
                  </span>
                  <span style={styles.tagCloud}>
                    📦 {selectedOrder.shippingStatus}
                  </span>
                </div>

                <h2 style={styles.orderTitle}>{selectedOrder.groupName}</h2>

                {selectedOrder.paymentStatus === "未付款" && (
                  <p style={styles.smallNotice}>
                    商品未滿NT1000元，等待官方通知
                  </p>
                )}

                {selectedOrder.paymentStatus === "未付款" ? (
                  <div style={styles.infoGrid}>
                    <Info
                      label="商品總數"
                      value={`${selectedOrder.itemCount} 件`}
                    />
                    <Info
                      label="總金額"
                      value={`NT$ ${selectedOrder.totalAmount.toLocaleString()}`}
                    />
                  </div>
                ) : (
                  <div style={styles.infoGrid}>
                    <Info
                      label="商品總數"
                      value={`${selectedOrder.itemCount} 件`}
                    />
                    <Info
                      label="總金額"
                      value={`NT$ ${selectedOrder.totalAmount.toLocaleString()}`}
                    />
                    <Info
                      label="應付訂金 50%"
                      value={`NT$ ${deposit.toLocaleString()}`}
                    />
                    <Info
                      label="應付尾款"
                      value={`NT$ ${finalPayment.toLocaleString()}`}
                    />
                  </div>
                )}

                <div style={styles.detailBox}>
                  <h3 style={styles.sectionTitle}>🛍️購買商品明細</h3>
                  {selectedOrder.items.map((item, index) => (
                    <div key={index} style={styles.itemRow}>
                      <span>
                        {item.name} × {item.qty}
                      </span>
                      <span>
                        NT$ {(item.price * item.qty).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>

                {selectedOrder.paymentStatus === "待匯定" ? (
                  <button
                    style={styles.primaryBtn}
                    onClick={() => setShowPaymentModal(true)}
                  >
                    💳 點我付款
                  </button>
                ) : selectedOrder.paymentStatus === "等待款項確認中" ? (
                  <button style={styles.secondaryBtn}>⏳ 等待款項確認中</button>
                ) : (
                  <button
                    style={styles.secondaryBtn}
                    onClick={openCustomerService}
                  >
                    💬 聯絡客服
                  </button>
                )}
              </>
            )}
          </section>
        )}

        {step === 5 && (
          <section style={styles.card}>
            <button style={styles.backBtn} onClick={() => setStep(1)}>
              ← 返回首頁
            </button>
            <img
              src="/deer-head.png"
              alt="咪路麋鹿"
              style={styles.finalDeerImage}
            />
            <h2 style={styles.title}>完成回報</h2>
            <p style={styles.finalText}>感謝您的訂購與信任！期待商品到來 ☁️</p>
          </section>
        )}
      </main>

      {showError && (
        <Modal>
          <h2 style={styles.modalTitle}>查無此暱稱</h2>
          <p style={styles.modalText}>請確認輸入之暱稱是否與社群回報吻合</p>
          <button style={styles.primaryBtn} onClick={() => setShowError(false)}>
            我知道了
          </button>
        </Modal>
      )}

      {showPaymentModal && selectedOrder && (
        <Modal>
          <h2 style={styles.modalTitle}>匯款資訊</h2>
          <div style={styles.paymentInfo}>
            <p>轉帳請備注社群暱稱💌</p>
            <p>例如：麋鹿/咖醬的狗</p>
            <br />
            <p>🦌可轉帳 / 無卡帳號 ⭣</p>
            <p>台新（812）28881013405739</p>
            <p>中信（822）193540210513</p>
            <p>國泰（013）699508481385</p>

            <p>🐶鏈鋸人快閃 / 韓國連線專用帳號 ⭣</p>
            <p>台新（812）28881011587005</p>
            <p>聯邦（803）888504565944</p>

            <br />

            <p>
              需付款金額：
              <strong>NT$ {deposit.toLocaleString()}</strong>
            </p>
          </div>

          <button
            style={styles.primaryBtn}
            onClick={() => {
              setShowPaymentModal(false);
              setShowCodeModal(true);
            }}
          >
            確認，我已匯款
          </button>
          <button
            style={styles.secondaryBtn}
            onClick={() => setShowPaymentModal(false)}
          >
            取消
          </button>
        </Modal>
      )}

      {showCodeModal && selectedOrder && (
        <Modal>
          <h2 style={styles.modalTitle}>輸入匯款後五碼</h2>

          <input
            style={styles.input}
            placeholder="請輸入 5 碼"
            value={lastFive}
            maxLength={5}
            onChange={(e) =>
              setLastFive(e.target.value.replace(/\D/g, "").slice(0, 5))
            }
          />

          {lastFive.length === 5 && (
            <div style={styles.confirmBox}>
              <p>暱稱：{nickname}</p>
              <p>團務：{selectedOrder.groupName}</p>
              <p>後五碼：{lastFive}</p>
              <p>金額：NT$ {deposit.toLocaleString()}</p>
            </div>
          )}

          <button style={styles.primaryBtn} onClick={reportPayment}>
            通知已匯款
          </button>
          <button
            style={styles.secondaryBtn}
            onClick={() => setShowCodeModal(false)}
          >
            取消
          </button>
        </Modal>
      )}
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div style={styles.infoBox}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Modal({ children }) {
  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalBox}>{children}</div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#dce9f7",
    padding: 18,
    fontFamily:
      '"jf open 粉圓", "Zen Maru Gothic", "Klee One", "LXGW WenKai TC", "Yuanti TC", "Microsoft JhengHei", sans-serif',
    color: "#163f66",
    backgroundImage:
      "radial-gradient(rgba(83,119,189,.16) 1px, transparent 1px)",
    backgroundSize: "22px 22px",
  },
  panel: {
    maxWidth: 430,
    minHeight: "92vh",
    margin: "0 auto",
    background: "#fff8ea",
    padding: 22,
    borderLeft: "8px solid #5377bd",
    borderRight: "8px solid #5377bd",
    boxShadow: "0 12px 32px rgba(64,100,138,.12)",
  },
  header: {
    textAlign: "center",
    padding: "8px 0 20px",
  },
  finalDeerImage: {
    width: 120,
    height: 120,
    objectFit: "contain",
    display: "block",
    margin: "0 auto 12px",
  },
  brand: {
    fontSize: 28,
    lineHeight: 1.4,
    fontWeight: 900,
    fontFamily:
      '"Arial Rounded MT Bold", "PingFang TC", "Noto Sans TC", sans-serif',
    letterSpacing: "1px",
  },
  heroImage: {
    width: "100%",
    aspectRatio: "1 / 1",
    backgroundImage: "url('/icon.png')",
    backgroundSize: "contain",
    backgroundRepeat: "no-repeat",
    backgroundPosition: "center",
    marginBottom: -34,
  },
  homeFormCard: {
    background: "#fffdfa",
    padding: 24,
    border: "3px solid #163f66",
    boxShadow: "6px 6px 0 rgba(22,63,102,.26)",
    marginBottom: 24,
    position: "relative",
    zIndex: 2,
  },
  card: {
    background: "#fffdfa",
    padding: 24,
    border: "3px solid #163f66",
    boxShadow: "6px 6px 0 rgba(22,63,102,.26)",
    marginBottom: 24,
  },
  title: {
    textAlign: "center",
    fontSize: 28,
    margin: "6px 0 8px",
    fontWeight: 800,
  },
  helperText: {
    textAlign: "center",
    color: "#5b7896",
    fontSize: 14,
    fontWeight: 700,
  },
  input: {
    width: "78%",
    display: "block",
    margin: "18px auto 0",
    padding: "13px 16px",
    border: "2px solid #163f66",
    background: "#eef6ff",
    textAlign: "center",
    fontSize: 16,
    fontWeight: 700,
    boxSizing: "border-box",
    outline: "none",
  },
  primaryBtn: {
    width: "100%",
    marginTop: 16,
    padding: 15,
    border: "2px solid #163f66",
    background: "#83bde8",
    color: "#163f66",
    fontSize: 17,
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "4px 4px 0 rgba(22,63,102,.24)",
  },
  secondaryBtn: {
    width: "100%",
    marginTop: 12,
    padding: 15,
    border: "2px solid #163f66",
    background: "#fff8ea",
    color: "#163f66",
    fontSize: 17,
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "4px 4px 0 rgba(22,63,102,.20)",
  },
  backBtn: {
    border: "2px solid #163f66",
    background: "#fff8ea",
    color: "#163f66",
    fontWeight: 800,
    fontSize: 15,
    marginBottom: 14,
    padding: "8px 12px",
    cursor: "pointer",
  },
  filterCard: {
    background: "#fffdfa",
    border: "3px solid #163f66",
    padding: 18,
    boxShadow: "6px 6px 0 rgba(22,63,102,.26)",
    marginBottom: 24,
  },
  summaryRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    color: "#3d8fbf",
    fontWeight: 800,
    marginBottom: 16,
  },
  selectPill: {
    border: "2px solid #3d8fbf",
    padding: "5px 10px",
    background: "#eef6ff",
    fontSize: 13,
  },
  orderCount: { fontSize: 15 },
  mainTabs: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 9,
  },
  filterTab: {
    border: "2px solid #163f66",
    padding: "11px 8px",
    background: "#fffdfa",
    color: "#163f66",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "3px 3px 0 rgba(22,63,102,.22)",
  },
  filterTabActive: {
    background: "#83bde8",
    color: "#fff",
  },
  filterGroups: {
    marginTop: 14,
    background: "#eef6ff",
    border: "2px solid #163f66",
    padding: 12,
  },
  filterLabel: {
    color: "#163f66",
    fontWeight: 800,
    marginBottom: 8,
  },
  chipWrap: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    border: "2px solid #163f66",
    padding: "8px 12px",
    background: "#fffdfa",
    color: "#163f66",
    fontWeight: 700,
    cursor: "pointer",
  },
  chipActive: {
    background: "#5f83d1",
    color: "#fff",
  },
  orderCard: {
    background: "#fffdfa",
    border: "3px solid #163f66",
    padding: 24,
    minHeight: 185,
    boxShadow: "6px 6px 0 rgba(22,63,102,.26)",
    marginBottom: 24,
    cursor: "pointer",
  },
  tags: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 18,
  },
  tagBlue: {
    background: "#5f83d1",
    color: "#fff",
    padding: "7px 12px",
    fontSize: 14,
    fontWeight: 800,
    border: "1px solid #163f66",
  },
  tagCream: {
    background: "#83bde8",
    color: "#163f66",
    padding: "7px 12px",
    fontSize: 14,
    fontWeight: 800,
    border: "1px solid #163f66",
  },
  tagCloud: {
    background: "#fff8ea",
    color: "#163f66",
    border: "1px solid #163f66",
    padding: "7px 12px",
    fontSize: 14,
    fontWeight: 800,
  },
  orderTitle: {
    fontSize: 26,
    lineHeight: 1.35,
    fontWeight: 800,
    margin: "12px 0 22px",
  },
  smallNotice: {
    marginTop: -12,
    marginBottom: 16,
    fontSize: 13,
    color: "#5b7896",
    fontWeight: 700,
    lineHeight: 1.6,
  },
  orderFooter: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 16,
  },
  qty: {
    border: "2px solid #163f66",
    padding: "8px 16px",
    fontWeight: 800,
    background: "#fffdfa",
  },
  totalBox: { textAlign: "right" },
  totalLabel: {
    display: "block",
    fontWeight: 800,
    color: "#5b7896",
    fontSize: 14,
  },
  total: {
    color: "#8fb9ef",
    fontSize: 32,
    fontWeight: 800,
  },
  detailHeader: {
    borderBottom: "2px dashed #163f66",
    paddingBottom: 16,
    marginBottom: 16,
  },
  infoOne: {
    background: "#eef6ff",
    borderLeft: "5px solid #83bde8",
    padding: 16,
    display: "flex",
    justifyContent: "space-between",
    fontWeight: 800,
    marginBottom: 14,
  },
  noticeBox: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    background: "#fff1c9",
    color: "#9b6b00",
    padding: "10px 16px",
    fontWeight: 800,
    fontSize: 15,
    borderRadius: 999,
    border: "2px dashed #f2b94b",
    boxShadow: "0 4px 10px rgba(242,185,75,.18)",
    marginTop: 0,
    marginBottom: 0,
  },
  titleRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
  },
  infoGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
  },
  infoBox: {
    background: "#eef6ff",
    border: "2px solid #163f66",
    padding: 13,
    display: "flex",
    flexDirection: "column",
    gap: 5,
    fontWeight: 800,
  },
  detailBox: {
    marginTop: 16,
    background: "#fffdfa",
    borderTop: "2px dashed #163f66",
    padding: "16px 0 0",
  },
  sectionTitle: {
    margin: "0 0 12px",
  },
  itemRow: {
    display: "flex",
    justifyContent: "space-between",
    padding: "10px 0",
    borderBottom: "2px dashed #b8cee5",
    fontWeight: 700,
  },
  emptyCard: {
    background: "#fffdfa",
    border: "2px dashed #b8cee5",
    padding: 34,
    textAlign: "center",
    color: "#5b7896",
    fontWeight: 800,
  },
  emptyIcon: { fontSize: 40 },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(22,63,102,.28)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    zIndex: 99,
  },
  modalBox: {
    width: 310,
    background: "#fffdfa",
    border: "3px solid #163f66",
    padding: 24,
    boxShadow: "6px 6px 0 rgba(22,63,102,.26)",
    color: "#163f66",
    fontWeight: 700,
  },
  modalTitle: {
    textAlign: "center",
    fontSize: 26,
    fontWeight: 800,
  },
  modalText: {
    textAlign: "center",
    lineHeight: 1.7,
    color: "#5b7896",
  },
  paymentInfo: {
    background: "#eef6ff",
    border: "2px solid #163f66",
    padding: 14,
    lineHeight: 1.8,
  },
  confirmBox: {
    background: "#eef6ff",
    border: "2px solid #163f66",
    padding: 14,
    marginTop: 14,
  },
  finalText: {
    textAlign: "center",
    fontSize: 20,
    fontWeight: 800,
    lineHeight: 1.8,
  },
};
