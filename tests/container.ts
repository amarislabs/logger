import { createConsola } from "consola";
import { ContainerReporter } from "#/index";

const logger = createConsola().setReporters([new ContainerReporter({ lineBreakBehavior: "auto" })]);

logger.info("Genesis 1:1-3");
logger.log(
    "In the beginning God created the heaven and the earth. And the earth was without form, and void; and darkness was upon the face of the deep. And the Spirit of God moved upon the face of the waters. And God said, Let there be light: and there was light."
);

logger.log("[[-]]");

logger.log("Hello, world!");
logger.warn("Hello, world!");
logger.error("Hello, world!");
logger.fail("Hello, world!");
logger.fatal("Hello, world!");
logger.success("Hello, world!");
logger.start("Hello, world!");

logger.log("[[-]]");
