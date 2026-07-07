import { getEcosystem } from "@/lib/ecosystem";
import RefreshButton from "./RefreshButton";

export const dynamic = "force-dynamic";

function Stat({ label, value }) {
  return (
    <div className="eco-stat">
      <div className="eco-stat-v">{value}</div>
      <div className="eco-stat-l">{label}</div>
    </div>
  );
}

function EnvNode({ env }) {
  return (
    <div className="eco-node">
      <div className="eco-node-head">
        <span className="eco-node-ico">{env.icon}</span>
        <span className="eco-node-title">{env.name}</span>
        {env.webui && <span className="eco-tag webui">⚡ WebUI 실행</span>}
      </div>
      <code className="eco-path">{env.clone}</code>
      <div className="eco-row">
        <span className="eco-k">clone HEAD</span>
        <span className="eco-mono">{env.head ?? "—"}</span>
        {env.inSync === true && <span className="eco-sync ok">● 동기화됨</span>}
        {env.inSync === false && <span className="eco-sync off">● 뒤처짐</span>}
        {env.inSync === null && <span className="eco-sync na">● 미상</span>}
      </div>
      <div className="eco-skills">
        <span className="eco-k">~/.claude/skills</span>
        <div className="eco-chips">
          {env.claudeSkills.length === 0 && <span className="eco-chip off">없음</span>}
          {env.claudeSkills.map((s) => (
            <span className="eco-chip" key={s.name}>{s.name}<em>{s.method}</em></span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function EcosystemPage() {
  const eco = getEcosystem();

  return (
    <div className="eco">
      <div className="eco-top">
        <div>
          <h1>개발 생태계</h1>
          <p>Claude_Manager 허브를 중심으로 한 <strong>실제 구성 상태</strong>입니다. 아래 새로고침은
            git·파일시스템을 다시 읽어 갱신합니다. <em>스캔: {eco.scannedAt}</em></p>
        </div>
        <RefreshButton />
      </div>

      <div className="eco-stats">
        <Stat label="환경" value={eco.envs.length} />
        <Stat label="skills" value={eco.content.skills.length} />
        <Stat label="표준·문서" value={eco.content.standards + eco.content.references + eco.content.issues} />
        <Stat label="커밋" value={eco.hub.commits ?? "—"} />
      </div>

      <div className="eco-diagram">
        {/* 허브 */}
        <div className="eco-hub">
          <div className="eco-hub-head">
            <span className="eco-node-ico">🔒</span>
            <span className="eco-node-title">{eco.hub.provider} · 단일 원본</span>
            <span className="eco-tag">private</span>
          </div>
          <code className="eco-path">{eco.hub.name}</code>
          <div className="eco-hub-meta">
            <span><b>{eco.hub.branch}</b> @ {eco.hub.head ?? "—"}</span>
            <span className="eco-dot" />
            <span>{eco.hub.commits ?? "—"} commits</span>
            {eco.hub.lastDate && <><span className="eco-dot" /><span>{eco.hub.lastDate}</span></>}
          </div>
          {eco.hub.lastMsg && <div className="eco-lastmsg">“{eco.hub.lastMsg}”</div>}
        </div>

        {/* 동기화 밴드 */}
        <div className="eco-band">
          <span className="eco-band-arrow">▲ push</span>
          <span className="eco-band-label">git 동기화</span>
          <span className="eco-band-arrow">pull ▼</span>
        </div>

        {/* 환경 두 개 */}
        <div className="eco-envs">
          {eco.envs.map((env) => <EnvNode env={env} key={env.key} />)}
        </div>

        {/* 공유 콘텐츠 밴드 */}
        <div className="eco-band down"><span className="eco-band-label">공유 콘텐츠 (git 추적) ▼</span></div>

        {/* 공유 콘텐츠 */}
        <div className="eco-shared">
          <div className="eco-node-head">
            <span className="eco-node-ico">📦</span>
            <span className="eco-node-title">공유 표준 · 문서 · Skills</span>
            <span className="eco-tag muted">양 환경이 clone으로 공유</span>
          </div>
          <div className="eco-shared-grid">
            <a className="eco-cat" href="/browse/repo/docs/standards"><b>{eco.content.standards}</b>표준 문서</a>
            <a className="eco-cat" href="/browse/repo/docs/references"><b>{eco.content.references}</b>참고자료</a>
            <a className="eco-cat" href="/browse/repo/docs/issues"><b>{eco.content.issues}</b>이슈 로그</a>
            <a className="eco-cat" href="/browse/repo/skills"><b>{eco.content.skills.length}</b>Skills</a>
          </div>
          <div className="eco-chips">
            {eco.content.skills.map((s) => <span className="eco-chip" key={s}>{s}</span>)}
          </div>
        </div>
      </div>

      <p className="eco-note">
        <strong>새로고침 = 실시간 재스캔.</strong> 이 페이지는 매 요청마다 git 상태와 파일을 다시 읽습니다.
        git pull·skill 추가 후 새로고침하면 즉시 반영됩니다. (브라우저 버튼이 Claude Code를 직접 실행하는 것은
        아니며, 데이터가 실시간이라 갱신이 필요 없는 구조입니다.)
      </p>
    </div>
  );
}
