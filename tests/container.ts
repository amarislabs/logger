import { createConsola } from "consola";
import { ContainerReporter } from "#/index";

const logger = createConsola().setReporters([new ContainerReporter({})]);

logger.log("original\nhello world1\nhello world2\nhello world3\n\nhello world4");
