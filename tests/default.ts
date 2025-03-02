import { createConsola } from "consola";
import { DefaultReporter } from "#/index";

const logger = createConsola({ formatOptions: { date: false } }).setReporters([
    new DefaultReporter({ padding: 8, addTypeColon: true, dateFirstPosition: false }),
]);

logger.info("Genesis 1:1-3");
logger.log(
    "In the beginning God created the heaven and the earth. And the earth was without form, and void; and darkness was upon the face of the deep. And the Spirit of God moved upon the face of the waters. And God said, Let there be light: and there was light."
);

logger.log("Hello, world!");
logger.warn("Hello, world!");
logger.error("Hello, world!");
logger.success("Hello, world!");
logger.start("Hello, world!");
