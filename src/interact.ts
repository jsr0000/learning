import {
  Mina, PrivateKey, PublicKey, fetchAccount
} from 'o1js';

import { Add } from './Add.js';

const Network = Mina.Network('https://api.minascan.io/node/devnet/v1/graphql');

Mina.setActiveInstance(Network);
