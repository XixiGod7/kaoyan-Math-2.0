(function (root) {
  const actions = [
    "goals",
    "session/start",
    "session/end",
    "session/cooling",
    "points/adjust",
    "tokens/adjust",
    "bank/loan",
    "bank/loan/repay",
    "bank/deposit",
    "bank/deposit/claim",
    "secondary_payment/add",
    "secondary_payment/update",
    "store/buy",
    "caterpillar/add",
    "caterpillar/toggle",
    "caterpillar/draw",
    "pbl/add",
    "pbl/milestone/toggle",
  ];
  const allowed = (path) =>
    /^\/api\/(?:answer(?:\/[^/]+\/time)?|math\/grade|note(?:\/append)?|favorite(?:\/(?:tag|star))?|wrong-book\/[^/]+(?:\/(?:collect|master))?|review\/(?:answer|enroll|drop)|exam-papers(?:\/.*)?|politics\/(?:answer|note|favorite|review|papers\/[^/]+\/(?:draft|submit))|english\/(?:storage|note|submit|review|practice)|me\/(?:nickname|beta)|study\/(?:position|restore|cleanup))$/.test(
      path,
    ) || actions.some((a) => path === "/api/incentive/" + a);
  const api = { actions, allowed };
  if (typeof module !== "undefined") module.exports = api;
  else root.studyOperations = api;
})(typeof window === "undefined" ? {} : window);
