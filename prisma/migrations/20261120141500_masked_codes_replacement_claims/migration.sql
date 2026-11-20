ALTER TABLE "User" ADD COLUMN "maskedCode" TEXT;

WITH numbered_users AS (
    SELECT "id", ROW_NUMBER() OVER (ORDER BY "id") AS "row_number"
    FROM "User"
)
UPDATE "User" AS users
SET "maskedCode" = 'MASK-' || LPAD(numbered_users."row_number"::TEXT, 12, '0')
FROM numbered_users
WHERE users."id" = numbered_users."id";

ALTER TABLE "User" ALTER COLUMN "maskedCode" SET NOT NULL;
CREATE UNIQUE INDEX "User_maskedCode_key" ON "User"("maskedCode");

ALTER TABLE "Upload" ADD COLUMN "claimedForModerationId" TEXT;
CREATE UNIQUE INDEX "Upload_claimedForModerationId_key" ON "Upload"("claimedForModerationId");
