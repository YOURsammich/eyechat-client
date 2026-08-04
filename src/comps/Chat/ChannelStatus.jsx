// The gate indicators in the chat header: whitelist mode and the proxy/VPN
// block. Both are channel settings only an admin can change (/whitelist,
// /proxyblock), but the badges are shown to everyone — a guest who can't see
// why the room turned people away has no way to ask for access.
//
// Values arrive with channelInfo on join and live via setState; see ChatWindow.

// Trust at or below this is exempt from the proxy gate — PROXY_EXEMPT_TRUST in
// src/models/channel.js. Only used in the tooltip wording.
const PROXY_EXEMPT_TRUST = 4;

export default function ChannelStatus({ checkTrust, proxyBlock }) {
  const whitelist = Number(checkTrust) > 0;
  // 'guests' and 'all' differ in who they turn away, so they get their own look:
  // amber outlined for guests-only, red filled for everyone unvetted.
  const proxy = proxyBlock === 'guests' || proxyBlock === 'all' ? proxyBlock : null;

  if (!whitelist && !proxy) return null;

  return (
    <div className='channelStatus'>
      {whitelist ? (
        <span
          className='material-symbols-outlined statusBadge statusWhitelist'
          title='Whitelist mode — only trusted users may join'
        >lock</span>
      ) : null}

      {proxy === 'guests' ? (
        <span
          className='material-symbols-outlined statusBadge statusProxyGuests'
          title='Proxy blocking: guests — guests must log in to connect through a proxy or VPN'
        >vpn_lock</span>
      ) : null}

      {proxy === 'all' ? (
        <span
          className='material-symbols-outlined statusBadge statusProxyAll'
          title={`Proxy blocking: everyone — no proxy or VPN connections above trust ${PROXY_EXEMPT_TRUST}`}
        >vpn_lock</span>
      ) : null}
    </div>
  );
}
