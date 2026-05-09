import type { AgentArtifact } from "@/lib/types";
import CodeArtifact from "./CodeArtifact";
import PolarityDiagram from "./PolarityDiagram";
import DutyCycleCalculator from "./DutyCycleCalculator";
import TroubleshootingFlow from "./TroubleshootingFlow";
import SettingsConfigurator from "./SettingsConfigurator";
import ManualReferencePanel from "./ManualReferencePanel";
import ManualPageViewer from "./ManualPageViewer";
import GuidedSession from "@/components/guided/GuidedSession";

type Props = { artifact: AgentArtifact; onAskFollowUp?: (q: string) => void };

export default function ArtifactRenderer({ artifact, onAskFollowUp }: Props) {
  switch (artifact.type) {
    case "code":
      return <CodeArtifact code={artifact.code} title={artifact.title} language={artifact.language} />;
    case "polarity-diagram":
      return <PolarityDiagram process={artifact.process} connections={artifact.connections} />;
    case "duty-cycle-calculator":
      return <DutyCycleCalculator defaults={artifact.defaults} table={artifact.table} />;
    case "troubleshooting-flow":
      return <TroubleshootingFlow issue={artifact.issue} title={artifact.title} steps={artifact.steps} />;
    case "settings-configurator":
      return <SettingsConfigurator defaults={artifact.defaults} />;
    case "manual-reference":
      return <ManualReferencePanel document={artifact.document} pages={artifact.pages} reason={artifact.reason} />;
    case "manual-page-viewer":
      return <ManualPageViewer pages={artifact.pages} />;
    case "guided-session":
      return (
        <GuidedSession
          title={artifact.title}
          intro={artifact.intro}
          steps={artifact.steps}
          onAskFollowUp={onAskFollowUp ?? (() => {})}
        />
      );
    default:
      return null;
  }
}
