import { createConsola } from "consola";
import { ContainerReporter } from "#/index";

const logger = createConsola().setReporters([new ContainerReporter({ lineBreakBehavior: "always" })]);

logger.info(
    "mXvAZxsUFYWQmTMkILffGdZnhswKowiAWSlMuHNHYhlAKeCSrwyiBzlKZyKPkuJbloDZUeFrEJxcxRhMKFNEeJWtbcJudrPyZjcTcbpLDIRpbsZebCkbGrqwQjxGDNeSoWdADjbpCxnakntgSayriKqoSIItsapwigaegkhaoitapoweweweweewewew"
);

logger.log(
    "Lorem ipsum odor amet, consectetuer!Lorem ipsum odor amet, consectetuer!Lorem ipsum odor amet, consectetuer!Lorem ipsum odor amet, consectetuer!Lorem ipsum odor amet, consectetuer!Lorem ipsum odor amet, consectetuer!Lorem ipsum odor amet, consectetuer!Lorem ipsum odor amet, consectetuer!Lorem ipsum odor amet, consectetuer!Lorem ipsum odor amet, consectetuer!Lorem ipsum odor amet, consectetuer!Lorem ipsum odor amet, consectetuer!Lorem ipsum odor amet, consectetuer!Lorem ipsum odor amet, consectetuer!Lorem ipsum odor amet, consectetuer!Lorem ipsum odor amet, consectetuer!Lorem ipsum odor amet, consectetuer!Lorem ipsum odor amet, consectetuer!"
);

logger.withTag("tag").info("Lorem ipsum odor amet, consectetuer!");

logger.log(
    "Lorem ipsum odor amet, consectetuer!Lorem ipsum odor amet, consectetuer!Lorem ipsum odor amet, consectetuer!Lorem ipsum odor amet, consectetuer!Lorem ipsum odor amet, consectetuer!Lorem ipsum odor amet, consectetuer!Lorem ipsum odor amet, consectetuer!Lorem ipsum odor amet, consectetuer!Lorem ipsum odor amet, consectetuer!Lorem ipsum odor amet, consectetuer!Lorem ipsum odor amet, consectetuer!Lorem ipsum odor amet, consectetuer!Lorem ipsum odor amet, consectetuer!Lorem ipsum odor amet, consectetuer!Lorem ipsum odor amet, consectetuer!Lorem ipsum odor amet, consectetuer!Lorem ipsum odor amet, consectetuer!Lorem ipsum odor amet, consectetuer!"
);
