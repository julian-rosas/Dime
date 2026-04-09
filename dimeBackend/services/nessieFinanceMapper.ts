import { UserState } from "./finance";

export function mapAccountToUserState(accounts: any, costumerId: string, nessieId: string): UserState {
    return {
      userId: costumerId, 
      nessieId: nessieId,
      accounts,
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
  