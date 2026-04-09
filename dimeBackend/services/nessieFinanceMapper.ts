import { UserState } from "./finance";

export function mapAccountToUserState(account: any): UserState {
    return {
      userId: account.customer_id, 
      accountId: account,
      balance: account.balance,
      contacts: [
        // replace for any logic to get from ddb
        { name: "Juan García", alias: ["juan", "juancho"] },
        { name: "María López", alias: ["maria", "mary", "mamá", "mama"] },
        { name: "Carlos Pérez", alias: ["carlos", "carlitos"] },
      ],
      savings: [],
      pendingOperation: null,
    };
  }
  