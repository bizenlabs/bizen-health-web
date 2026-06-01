import {
  DescriptionDetails,
  DescriptionList,
  DescriptionTerm,
} from "@/components/catalyst/description-list";
import { Divider } from "@/components/catalyst/divider";
import { OrgNameForm } from "./OrgNameForm";

type Props = {
  orgName: string;
  organizationId: string;
  orgType: string | null;
  isAdmin: boolean;
};

export function GeneralSection({
  orgName,
  organizationId,
  orgType,
  isAdmin,
}: Props) {
  return (
    <div className="mt-8">
      {isAdmin ? (
        <>
          <OrgNameForm initialName={orgName} />
          <Divider soft className="my-8" />
        </>
      ) : null}

      <DescriptionList>
        {!isAdmin ? (
          <>
            <DescriptionTerm>Workspace name</DescriptionTerm>
            <DescriptionDetails>{orgName}</DescriptionDetails>
          </>
        ) : null}

        <DescriptionTerm>Account type</DescriptionTerm>
        <DescriptionDetails className="capitalize">
          {orgType ?? "—"}
        </DescriptionDetails>

        <DescriptionTerm>Organization ID</DescriptionTerm>
        <DescriptionDetails>
          <span className="font-mono text-xs">{organizationId}</span>
        </DescriptionDetails>
      </DescriptionList>
    </div>
  );
}
