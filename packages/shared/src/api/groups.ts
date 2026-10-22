export interface GroupView {
  id: string;
  name: string;
  archivedAt: string | null;
  activeStudentCount: number;
}

export interface GroupListResponse {
  items: GroupView[];
  total: number;
  offset: number;
  limit: number;
}

export interface GroupListQuery {
  offset?: number;
  limit?: number;
  archived?: boolean;
}

export interface CreateGroupInput {
  name: string;
}

export interface UpdateGroupInput {
  name: string;
}

export interface MembershipView {
  id: string;
  groupId: string;
  groupName: string;
  joinedAt: string;
  leftAt: string | null;
}

export interface MembershipListResponse {
  items: MembershipView[];
  total: number;
  offset: number;
  limit: number;
}

export interface TransferStudentGroupInput {
  groupId: string;
}
