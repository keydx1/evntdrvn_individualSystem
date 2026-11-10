/**
 * Maps an AquaPiol user to an HR employee ID.
 *
 * Usage:
 *   node scripts/map-employee.js <user-email> <external-employee-id>
 *   node scripts/map-employee.js staff@aquapiol.local EMP-0042
 *
 * HR stays the source of truth; AquaPiol only stores the reference so stock
 * movements can be attributed to a person.
 */
import { sequelize, User } from "../models/index.js";

const [, , email, externalId] = process.argv;

const run = async () => {
  if (!email || !externalId) {
    console.error("Usage: node scripts/map-employee.js <user-email> <external-employee-id>");
    process.exitCode = 1;
    return;
  }

  await sequelize.authenticate();

  const user = await User.findOne({ where: { email } });
  if (!user) {
    console.error(`❌ No AquaPiol user found with email ${email}.`);
    process.exitCode = 1;
    return;
  }

  const clash = await User.findOne({ where: { externalEmployeeId: externalId } });
  if (clash && clash.id !== user.id) {
    console.error(`❌ ${externalId} is already mapped to ${clash.email}.`);
    process.exitCode = 1;
    return;
  }

  await user.update({ externalEmployeeId: externalId });
  console.log(`✅ ${user.email} is now mapped to HR employee ${externalId}.`);
};

run()
  .catch((error) => {
    console.error("❌ Mapping failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
