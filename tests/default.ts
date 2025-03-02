import { createConsola } from "consola";
import { DefaultReporter } from "#/index";

const logger = createConsola({ formatOptions: { date: true } }).setReporters([
    new DefaultReporter({ padding: 3, addTypeColon: true, dateFirstPosition: true }),
]);

logger.info("Hello, world!");
logger.warn("Hello, world!");
logger.error("Hello, world!");
logger.success("Hello, world!");
logger.start("Hello, world!");
