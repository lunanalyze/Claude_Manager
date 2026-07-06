// 워크숍/조립 페이지가 공유하는 더미 데이터 (하나의 가상 SaaS 대시보드)

export const KPIS = [
  { label: "월 매출", value: "₩ 128,400,000", delta: "+12.4%", up: true },
  { label: "신규 가입", value: "1,284", delta: "+8.1%", up: true },
  { label: "이탈률", value: "2.3%", delta: "-0.4%", up: true }, // 낮아짐=좋음
  { label: "활성 사용자", value: "9,410", delta: "+3.2%", up: true },
];

export const ORDERS = [
  { id: "#10245", customer: "김민준", plan: "Pro", amount: 49000, status: "완료", date: "07-06" },
  { id: "#10244", customer: "이서연", plan: "Team", amount: 129000, status: "대기", date: "07-06" },
  { id: "#10243", customer: "박지후", plan: "Basic", amount: 19000, status: "완료", date: "07-05" },
  { id: "#10242", customer: "최유나", plan: "Pro", amount: 49000, status: "실패", date: "07-05" },
  { id: "#10241", customer: "정도윤", plan: "Team", amount: 129000, status: "완료", date: "07-04" },
];

export const STATUS_KIND = { 완료: "ok", 대기: "wait", 실패: "fail" };

export const TREND = [
  { m: "1월", 매출: 82, 비용: 54 },
  { m: "2월", 매출: 91, 비용: 58 },
  { m: "3월", 매출: 99, 비용: 60 },
  { m: "4월", 매출: 105, 비용: 63 },
  { m: "5월", 매출: 118, 비용: 66 },
  { m: "6월", 매출: 128, 비용: 70 },
];

export const DEPT = [
  { name: "영업", v: 128 },
  { name: "마케팅", v: 96 },
  { name: "제품", v: 74 },
  { name: "지원", v: 52 },
];

export function fmtWon(n) {
  return "₩ " + n.toLocaleString("ko-KR");
}
